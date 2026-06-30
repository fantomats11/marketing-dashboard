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
  }
}

export class CentralApiHub {
  static async fetchAccountData(
    platform: string,
    accountId: string,
    metadata: any
  ): Promise<NormalizedMarketingData[]> {
    // จำลอง Latency ของ API จริง (ประมาณ 50ms - 150ms)
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100))

    switch (platform) {
      case 'facebook-ads':
        return this.fetchMeta(accountId, metadata)
      case 'google-ads':
        return this.fetchGoogle(accountId, metadata)
      case 'tiktok-ads':
        return this.fetchTikTokAds(accountId, metadata)
      case 'tiktok-shop':
        return this.fetchTikTokShop(accountId, metadata)
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  private static fetchMeta(accountId: string, metadata: any): NormalizedMarketingData[] {
    const limit = metadata?.ad_spend_limit || 5000
    return [
      {
        campaignId: `camp-meta-101-${accountId}`,
        campaignName: 'Meta Summer Conversion Campaign',
        status: 'ACTIVE',
        targeting: {
          locations: ['TH', 'SG', 'MY'],
          ageRanges: ['20-35'],
          interests: ['Online Shopping', 'Retail', 'Fashion']
        },
        content: {
          adId: `ad-meta-901-${accountId}`,
          adName: 'Summer Catalog Ad - Dynamic Carousel',
          creativeUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
          performanceType: 'carousel'
        },
        metrics: {
          spend: Math.round(limit * 0.08),
          impressions: 48000,
          clicks: 1250,
          conversions: 85,
          revenue: 12500
        }
      },
      {
        campaignId: `camp-meta-102-${accountId}`,
        campaignName: 'Meta Brand Awareness Retargeting',
        status: 'PAUSED', // แคมเปญนี้ถูกหยุดชั่วคราว แต่ข้อมูลใช้จ่ายในอดีตต้องถูกเก็บรักษา
        targeting: {
          locations: ['TH'],
          ageRanges: ['18-65'],
          interests: ['Custom Audiences - Website Visitors']
        },
        content: {
          adId: `ad-meta-902-${accountId}`,
          adName: 'Brand Video Ad - 15 Seconds',
          creativeUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4',
          performanceType: 'video'
        },
        metrics: {
          spend: Math.round(limit * 0.03),
          impressions: 35000,
          clicks: 680,
          conversions: 15,
          revenue: 2200
        }
      }
    ]
  }

  private static fetchGoogle(accountId: string, metadata: any): NormalizedMarketingData[] {
    const limit = metadata?.ad_spend_limit || 5000
    return [
      {
        campaignId: `camp-gg-201-${accountId}`,
        campaignName: 'Google Search - High Intent Keywords',
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
          spend: Math.round(limit * 0.12),
          impressions: 25000,
          clicks: 3400,
          conversions: 190,
          revenue: 38500
        }
      },
      {
        campaignId: `camp-gg-202-${accountId}`,
        campaignName: 'Google Performance Max - All Products',
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
          spend: Math.round(limit * 0.18),
          impressions: 125000,
          clicks: 8200,
          conversions: 410,
          revenue: 62000
        }
      }
    ]
  }

  private static fetchTikTokAds(accountId: string, metadata: any): NormalizedMarketingData[] {
    const limit = metadata?.ad_spend_limit || 5000
    return [
      {
        campaignId: `camp-tt-301-${accountId}`,
        campaignName: 'TikTok Sparks - Viral Creator Collab',
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
          revenue: 45000
        }
      }
    ]
  }

  private static fetchTikTokShop(accountId: string, metadata: any): NormalizedMarketingData[] {
    // สำหรับ E-commerce Shop ข้อมูลมักจะมาในรูปของยอดขายและจำนวนออเดอร์
    // แปลงมาเป็น: spend = 0 (หรือดึงสถิติ affiliate commission), conversions = orders, revenue = GMV
    return [
      {
        campaignId: `shop-tshop-401-${accountId}`,
        campaignName: 'TikTok Shop - Affiliate Creator Program',
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
          spend: 1200, // ค่าสปอนเซอร์ หรือ ค่าคอมมิชชันพันธมิตร
          impressions: 320000,
          clicks: 28400,
          conversions: 1450, // จำนวนคำสั่งซื้อ (Orders)
          revenue: 142000 // GMV (ยอดขายรวม)
        }
      }
    ]
  }
}
