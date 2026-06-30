export interface NormalizedMarketingData {
  campaignId: string
  campaignName: string
  status: 'ACTIVE' | 'PAUSED' | 'INACTIVE'
  targeting: {
    locations?: string[]
    ageRanges?: string[]
    interests?: string[]
    customTargeting?: Record<string, any>
  }
  content: {
    adId: string
    adName: string
    creativeUrl?: string
    performanceType: string
  }
  metrics: {
    spend: number
    impressions: number
    clicks: number
    conversions: number
    revenue: number
    reach: number
  }
  metricDate?: string // วันที่ข้อมูล (YYYY-MM-DD) สำหรับการบันทึกประวัติย้อนหลังรายวัน
}

export class CentralApiHub {
  static async fetchAccountData(
    platform: string,
    accountId: string,
    metadata: any
  ): Promise<NormalizedMarketingData[]> {
    switch (platform) {
      case 'facebook-ads':
        return await this.fetchMeta(accountId, metadata)
      case 'google-ads':
        return await this.fetchGoogle(accountId, metadata)
      case 'tiktok-ads':
        return await this.fetchTikTokAds(accountId, metadata)
      case 'tiktok-shop':
        return await this.fetchTikTokShop(accountId, metadata)
      default:
        return []
    }
  }

  private static async fetchMeta(accountId: string, metadata: any): Promise<NormalizedMarketingData[]> {
    const accessToken = metadata?.access_token || process.env.META_ACCESS_TOKEN
    
    if (!accessToken) {
      console.warn(`[Meta Ads] Missing access token for account ${accountId}.`)
      return []
    }
    
    const url = `https://graph.facebook.com/v25.0/act_${accountId}/insights?` + new URLSearchParams({
      level: 'ad',
      time_increment: '1',
      date_preset: 'this_month',
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,reach',
      access_token: accessToken,
      limit: '500'
    })

    try {
      const res = await fetch(url)
      const json = await res.json()

      if (json.error) {
        throw new Error(json.error.message)
      }

      const dataList = json.data || []
      
      return dataList.map((item: any) => {
        const leadAction = item.actions?.find((a: any) => a.action_type === 'onsite_conversion.lead' || a.action_type === 'lead')
        const msgAction = item.actions?.find((a: any) => a.action_type === 'onsite_conversion.total_messaging_connection')
        const conversions = Number(leadAction?.value || msgAction?.value || 0)
        const revenue = conversions * 15000 // สมมติมูลค่า Conversions ละ 15,000 บาท

        return {
          campaignId: item.campaign_id,
          campaignName: item.campaign_name,
          status: item.adset_name?.toLowerCase().includes('paused') ? 'PAUSED' : 'ACTIVE',
          targeting: {
            locations: ['TH'],
            interests: [item.adset_name || 'General Target']
          },
          content: {
            adId: item.ad_id,
            adName: item.ad_name,
            creativeUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=120',
            performanceType: 'messenger'
          },
          metrics: {
            spend: Number(item.spend || 0),
            impressions: Number(item.impressions || 0),
            clicks: Number(item.clicks || 0),
            conversions,
            revenue,
            reach: Number(item.reach || 0)
          },
          metricDate: item.date_start
        }
      })
    } catch (err: any) {
      console.error(`[Meta API Connection Error]:`, err.message || err)
      return []
    }
  }

  private static async fetchGoogle(accountId: string, metadata: any): Promise<NormalizedMarketingData[]> {
    const clientId = metadata?.client_id || process.env.GOOGLE_CLIENT_ID
    const clientSecret = metadata?.client_secret || process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = metadata?.refresh_token || process.env.GOOGLE_REFRESH_TOKEN
    const devToken = metadata?.developer_token || process.env.GOOGLE_DEVELOPER_TOKEN
    const customerId = accountId.replace(/-/g, '')

    if (!clientId || !clientSecret || !refreshToken || !devToken) {
      console.warn(`[Google Ads] Missing credentials for account ${accountId}.`)
      return []
    }

    try {
      // 1. แลก Access Token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })

      const tokenJson = await tokenRes.json()
      const accessToken = tokenJson.access_token

      if (!accessToken) {
        throw new Error('Google OAuth token exchange failed')
      }

      // 2. ดึงรายงานแคมเปญ
      const query = `
        SELECT 
          campaign.id, campaign.name, campaign.status,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING THIS_MONTH
      `

      const url = `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:search`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': devToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })

      const json = await res.json()

      if (json.error || !json.results) {
        throw new Error(json.error?.message || 'Empty response from Google Ads')
      }

      return json.results.map((row: any) => {
        const spend = Number(row.metrics?.costMicros || 0) / 1000000
        const conversions = Number(row.metrics?.conversions || 0)
        const revenue = Number(row.metrics?.conversionsValue || 0)

        return {
          campaignId: row.campaign.id,
          campaignName: row.campaign.name,
          status: row.campaign.status === 'ENABLED' ? 'ACTIVE' : 'PAUSED',
          targeting: { locations: ['TH'] },
          content: {
            adId: `ad-google-${row.campaign.id}`,
            adName: `${row.campaign.name} Ad Group`,
            performanceType: 'search'
          },
          metrics: {
            spend,
            impressions: Number(row.metrics?.impressions || 0),
            clicks: Number(row.metrics?.clicks || 0),
            conversions,
            revenue,
            reach: Math.round(Number(row.metrics?.impressions || 0) * 0.85)
          }
        }
      })

    } catch (err: any) {
      console.warn(`[Google Ads API Error]:`, err.message || err)
      return []
    }
  }

  private static async fetchTikTokAds(accountId: string, metadata: any): Promise<NormalizedMarketingData[]> {
    const accessToken = metadata?.access_token

    if (!accessToken) {
      console.warn(`[TikTok Ads] Missing access token for advertiser ${accountId}.`)
      return []
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

      // 1. ดึงข้อมูลแคมเปญทั้งหมดเพื่อเอาชื่อแคมเปญ (campaign_name)
      const campaignUrl = `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?` + new URLSearchParams({
        advertiser_id: accountId,
        page_size: '100'
      })
      const campaignRes = await fetch(campaignUrl, {
        headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' }
      })
      const campaignJson = await campaignRes.json()
      const campaignMap = new Map<string, string>()
      
      if (campaignJson.code === 0 && campaignJson.data?.list) {
        campaignJson.data.list.forEach((c: any) => {
          campaignMap.set(c.campaign_id, c.campaign_name)
        })
      }

      // 2. ดึงรายงานสถิติแยกตามแคมเปญ
      const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?` + new URLSearchParams({
        advertiser_id: accountId,
        report_type: 'BASIC',
        data_level: 'AUCTION_CAMPAIGN',
        dimensions: JSON.stringify(['campaign_id']),
        metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversion']),
        start_date: firstDay,
        end_date: today,
        page_size: '100'
      })

      const res = await fetch(url, {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      })

      const json = await res.json()

      if (json.code !== 0 || !json.data?.list) {
        throw new Error(json.message || 'Failed to fetch TikTok ads report')
      }

      return json.data.list.map((item: any) => {
        const campaignId = item.dimensions.campaign_id
        const campaignName = campaignMap.get(campaignId) || `TikTok Campaign ${campaignId}`
        const spend = Number(item.metrics?.spend || 0)
        const conversions = Number(item.metrics?.conversion || 0)
        const revenue = conversions * 8000 // มูลค่าต่อ Conversion สมมติของ TikTok

        return {
          campaignId,
          campaignName,
          status: 'ACTIVE',
          targeting: { locations: ['TH'] },
          content: {
            adId: `ad-tiktok-${campaignId}`,
            adName: `${campaignName} Ad`,
            performanceType: 'tiktok_feed'
          },
          metrics: {
            spend,
            impressions: Number(item.metrics?.impressions || 0),
            clicks: Number(item.metrics?.clicks || 0),
            conversions,
            revenue,
            reach: Math.round(Number(item.metrics?.impressions || 0) * 0.80)
          }
        }
      })

    } catch (err: any) {
      console.warn(`[TikTok Ads API Error]:`, err.message || err)
      return []
    }
  }

  private static async fetchTikTokShop(accountId: string, metadata: any): Promise<NormalizedMarketingData[]> {
    // ส่งข้อมูลว่างสำหรับ TikTok Shop / สถิติช่องครีเอเตอร์ออร์แกนิกเนื่องจากไม่ได้เน้นการยิงแคมเปญโฆษณาเป้าหมาย
    return []
  }
}
