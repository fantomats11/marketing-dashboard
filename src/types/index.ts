export interface AdAccount {
  id: string
  platform: string
  account_id: string
  account_name: string
  metadata: Record<string, any>
  created_at: string
}

export interface AnalyticsItem {
  id: string
  account_id: string
  metric_date: string
  dimensions: Record<string, any>
  metrics: Record<string, any>
  updated_at: string
  connected_ad_accounts?: {
    account_name: string
    platform: string
  } | null
}

export interface OfflineLead {
  id: string
  customer_name: string
  phone_number: string
  lead_type: string
  promo_code_used: string
  ad_network: string
  campaign_name: string
  target_audience: string
  ad_name: string
  creative_url: string
  status: string
  revenue_generated: number
  visited_at: string
  created_at: string
}
