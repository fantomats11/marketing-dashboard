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
        return this.fetchTikTokAds(accountId, metadata)
      case 'tiktok-shop':
        return this.fetchTikTokShop(accountId, metadata)
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  private static async fetchMeta(accountId: string, metadata: any): Promise<NormalizedMarketingData[]> {
    const accessToken = metadata?.access_token || process.env.META_ACCESS_TOKEN
    
    if (!accessToken) {
      console.warn(`[Meta Ads] Missing access token for account ${accountId}. Fallback to mock data.`)
      return this.getMetaMockData(accountId)
    }
    
    // ดึงสถิติรายวันย้อนหลังของเดือนนี้ (time_increment=1) เพื่อนำไปสร้างกราฟเส้นรายวันและวันในสัปดาห์ได้ตรงจริง
    const url = `https://graph.facebook.com/v25.0/act_${accountId}/insights?` + new URLSearchParams({
      level: 'ad',
      time_increment: '1',
      date_preset: 'this_month',
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,reach',
      access_token: accessToken,
      limit: '500' // ดึงข้อมูลสูงสุดต่อรอบ
    })

    try {
      const res = await fetch(url)
      const json = await res.json()

      if (json.error) {
        throw new Error(json.error.message)
      }

      const dataList = json.data || []
      
      // หากไม่มีข้อมูลจริงส่งกลับมา ให้เปลี่ยนไปแสดง Mock เพื่อให้กราฟบนหน้าแรกไม่ว่างเปล่า
      if (dataList.length === 0) {
        return this.getMetaMockData(accountId)
      }

      return dataList.map((item: any) => {
        // ดึงสถิติ Conversion (เช่น Lead หรือ แชทส่งข้อความเริ่มต้น)
        const leadAction = item.actions?.find((a: any) => a.action_type === 'onsite_conversion.lead' || a.action_type === 'lead')
        const msgAction = item.actions?.find((a: any) => a.action_type === 'onsite_conversion.total_messaging_connection')
        const conversions = Number(leadAction?.value || msgAction?.value || 0)

        // คำนวณรายได้สมมติของอสังหาริมทรัพย์: ฿15,000 ต่อ lead หรือค่าเฉลี่ย
        const revenue = conversions * 15000

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
          metricDate: item.date_start // บันทึกลงแคชโดยตรงตามวันที่ข้อมูลจริงรายวัน
        }
      })
    } catch (err: any) {
      console.error(`[Meta API Connection Error] Fallback to mock:`, err.message || err)
      return this.getMetaMockData(accountId)
    }
  }

  private static getMetaMockData(accountId: string): NormalizedMarketingData[] {
    return [
      {
        campaignId: `camp-meta-101-${accountId}`,
        campaignName: 'Meta Summer Conversion Campaign (Mock)',
        status: 'ACTIVE',
        targeting: {
          locations: ['TH', 'SG'],
          interests: ['Online Shopping', 'Retail']
        },
        content: {
          adId: `ad-meta-901-${accountId}`,
          adName: 'Summer Catalog Ad - Dynamic Carousel',
          creativeUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
          performanceType: 'carousel'
        },
        metrics: {
          spend: 3400,
          impressions: 48000,
          clicks: 1250,
          conversions: 85,
          revenue: 12500,
          reach: 41000
        }
      }
    ]
  }

  private static async fetchGoogle(accountId: string, metadata: any): Promise<NormalizedMarketingData[]> {
    const clientId = metadata?.client_id || process.env.GOOGLE_CLIENT_ID
    const clientSecret = metadata?.client_secret || process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = metadata?.refresh_token || process.env.GOOGLE_REFRESH_TOKEN
    const devToken = metadata?.developer_token || process.env.GOOGLE_DEVELOPER_TOKEN
    const customerId = accountId.replace(/-/g, '') // นำ Customer ID แบบไม่มีขีดคั่น

    if (!clientId || !clientSecret || !refreshToken || !devToken) {
      console.warn(`[Google Ads] Missing credentials for account ${accountId}. Fallback to mock data.`)
      return this.getGoogleMockData(accountId)
    }

    try {
      // 1. นำ Refresh Token แลกเปลี่ยน Access Token
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

      // 2. เรียกค้นข้อมูลโฆษณาใน Google Ads (ดึงช่วงเดือนปัจจุบัน)
      const query = `
        SELECT 
          campaign.id, campaign.name, campaign.status,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING THIS_MONTH
      `

      // ใช้เวอร์ชัน v17 ในการสืบค้นข้อมูล
      const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`
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
        throw new Error(json.error?.message || 'Empty or invalid response from Google Ads')
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
      console.warn(`[Google Ads API Connection Warning] Fallback to mock:`, err.message || err)
      return this.getGoogleMockData(accountId)
    }
  }

  private static getGoogleMockData(accountId: string): NormalizedMarketingData[] {
    return [
      {
        campaignId: `camp-gg-201-${accountId}`,
        campaignName: 'Google Search - High Intent Keywords (Mock)',
        status: 'ACTIVE',
        targeting: {
          locations: ['TH', 'US'],
          customTargeting: {
            keywords: ['buy apparel online', 'best marketing tools', 'e-commerce analytics']
          }
        },
        content: {
          adId: `ad-gg-801-${accountId}`,
          adName: 'Text Ad - Best E-Commerce Analytics Suite',
          performanceType: 'search_text'
        },
        metrics: {
          spend: 1800,
          impressions: 25000,
          clicks: 3400,
          conversions: 190,
          revenue: 38500,
          reach: 21500
        }
      },
      {
        campaignId: `camp-gg-202-${accountId}`,
        campaignName: 'Google Performance Max - All Products (Mock)',
        status: 'ACTIVE',
        targeting: {
          locations: ['TH'],
          ageRanges: ['18-45']
        },
        content: {
          adId: `ad-gg-802-${accountId}`,
          adName: 'PMax Asset Group - Summer Promotion 2026',
          creativeUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
          performanceType: 'pmax_assets'
        },
        metrics: {
          spend: 3200,
          impressions: 125000,
          clicks: 8200,
          conversions: 410,
          revenue: 62000,
          reach: 108000
        }
      }
    ]
  }

  private static fetchTikTokAds(accountId: string, metadata: any): NormalizedMarketingData[] {
    const limit = metadata?.ad_spend_limit || 5000
    return [
      {
        campaignId: `camp-tt-301-${accountId}`,
        campaignName: 'TikTok Sparks - Creator Collab (Mock)',
        status: 'ACTIVE',
        targeting: {
          locations: ['TH'],
          ageRanges: ['18-24', '25-34'],
          interests: ['Gaming', 'Tech Gadgets', 'Beauty & Cosmetics']
        },
        content: {
          adId: `ad-tt-701-${accountId}`,
          adName: 'Spark Ad - Creator unboxing gadget',
          creativeUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e',
          performanceType: 'spark_ad'
        },
        metrics: {
          spend: Math.round(limit * 0.15),
          impressions: 240000,
          clicks: 19500,
          conversions: 620,
          revenue: 45000,
          reach: 202000
        }
      }
    ]
  }

  private static fetchTikTokShop(accountId: string, metadata: any): NormalizedMarketingData[] {
    return [
      {
        campaignId: `shop-tshop-401-${accountId}`,
        campaignName: 'TikTok Shop - Creator Affiliate (Mock)',
        status: 'ACTIVE',
        targeting: {
          locations: ['TH'],
          customTargeting: {
            partnershipType: 'affiliate',
            activeCreators: 15
          }
        },
        content: {
          adId: `shop-creator-collab-${accountId}`,
          adName: 'Affiliate Creator Live streams & Shoppable Videos',
          performanceType: 'affiliate_video'
        },
        metrics: {
          spend: 1200,
          impressions: 320000,
          clicks: 28400,
          conversions: 1450,
          revenue: 142000,
          reach: 275000
        }
      }
    ]
  }
}
