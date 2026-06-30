'use client'

import React, { useState } from 'react'
import { simulateAdClick, simulateOfflineLead } from '@/app/actions'

import { OfflineLead } from '@/types'

export default function OfflineTracker({
  userId,
  offlineLeads,
  onRefresh
}: {
  userId: string
  offlineLeads: OfflineLead[]
  onRefresh: () => void
}) {
  // --- States for Ad Click Simulation ---
  const [clickPlatform, setClickPlatform] = useState('facebook-ads')
  const [clickCampaign, setClickCampaign] = useState('คอนโดหรูสุขุมวิท 2026')
  const [clickTarget, setClickTarget] = useState('กลุ่มสนใจอสังหาฯ อายุ 30-45 ปี')
  const [clickAd, setClickAd] = useState('แบนเนอร์ส่วนลด 100k')
  const [clickCreative, setClickCreative] = useState('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=120&auto=format&fit=crop&q=60')
  const [generatedPromoCode, setGeneratedPromoCode] = useState('')
  const [clickSimulating, setClickSimulating] = useState(false)

  // --- States for Lead Simulation ---
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadType, setLeadType] = useState('walk_in')
  const [leadPromoCode, setLeadPromoCode] = useState('')
  const [leadStatus, setLeadStatus] = useState('showroom_visited')
  const [leadRevenue, setLeadRevenue] = useState('50000')
  const [leadSimulating, setLeadSimulating] = useState(false)

  const handleSimulateClick = async () => {
    setClickSimulating(true)
    setGeneratedPromoCode('')
    try {
      const code = await simulateAdClick(
        clickPlatform,
        'camp-' + Math.random().toString(36).substring(2, 6),
        clickCampaign,
        clickTarget,
        'ad-' + Math.random().toString(36).substring(2, 6),
        clickAd,
        clickCreative
      )
      setGeneratedPromoCode(code)
    } catch (err) {
      console.error(err)
    } finally {
      setClickSimulating(false)
    }
  }

  const handleSimulateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadName) return
    setLeadSimulating(true)
    try {
      await simulateOfflineLead(
        leadName,
        leadPhone,
        leadType,
        leadPromoCode.trim(),
        leadStatus,
        Number(leadRevenue || 0)
      )
      // ล้างข้อมูลฟอร์ม
      setLeadName('')
      setLeadPhone('')
      setLeadPromoCode('')
      setLeadRevenue('50000')
      onRefresh() // ทริกเกอร์อัปเดตข้อมูลบนหน้าจอ
    } catch (err) {
      console.error(err)
    } finally {
      setLeadSimulating(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px', width: '100%' }}>
      
      {/* 1. Left Side: Simulation Control Panel (5 Columns) */}
      <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Ad Click Simulator */}
        <section className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            🔵 1. จำลองการคลิกโฆษณาออนไลน์ (Generate Promo Code)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            จำลองว่าลูกค้าเปิดเฟซบุ๊ก ค้นหาในกูเกิล หรือสไลด์ติ๊กต็อก แล้วกดคลิกเข้าลิ้งค์ของโครงการเพื่อรับรหัสคูปองเฉพาะตัว
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>ช่องทางโฆษณา (Platform)</span>
              <select value={clickPlatform} onChange={(e) => setClickPlatform(e.target.value)} className="input-field" style={{ padding: '8px' }}>
                <option value="facebook-ads">Facebook Ads</option>
                <option value="google-ads">Google Ads</option>
                <option value="tiktok-ads">TikTok Ads</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>ชื่อแคมเปญ (Campaign)</span>
              <input type="text" value={clickCampaign} onChange={(e) => setClickCampaign(e.target.value)} className="input-field" style={{ padding: '8px' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>กลุ่มเป้าหมาย (Audience Targeting)</span>
              <input type="text" value={clickTarget} onChange={(e) => setClickTarget(e.target.value)} className="input-field" style={{ padding: '8px' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>ชื่อชิ้นงานโฆษณา (Ad Content)</span>
              <input type="text" value={clickAd} onChange={(e) => setClickAd(e.target.value)} className="input-field" style={{ padding: '8px' }} />
            </label>

            <button
              onClick={handleSimulateClick}
              disabled={clickSimulating}
              className="btn-primary"
              style={{ padding: '10px', fontSize: '13px', marginTop: '6px' }}
            >
              {clickSimulating ? 'Simulating...' : '⚡ กดคลิกโฆษณานี้ชั่วคราว'}
            </button>
          </div>

          {generatedPromoCode && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px dashed #10B981',
              padding: '12px',
              borderRadius: '8px',
              textAlign: 'center',
              marginTop: '10px'
            }}>
              <span style={{ fontSize: '11px', color: '#10B981', display: 'block', fontWeight: 'bold' }}>รหัสคูปองเฉพาะตัวที่คุณได้รับ (Unique Promo Code):</span>
              <strong style={{ fontSize: '20px', color: 'white', letterSpacing: '1px', display: 'block', marginTop: '4px' }}>
                {generatedPromoCode}
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                * มอบรหัสนี้ให้เซลล์หน้าร้าน หรือพิมพ์กรอกบันทึกในระบบเพื่อ Attribution แหล่งโฆษณา
              </span>
            </div>
          )}
        </section>

        {/* CRM Lead Entry */}
        <section className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            🟢 2. บันทึกข้อมูลลูกค้าออฟไลน์ (Sales CRM Lead Entry)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            เซลล์ผู้ดูแลจดบันทึกรายชื่อผู้เข้าชมโครงการ (Walk-in) หรือลูกค้ายืนยันจองโครงการผ่าน Line OA โดยมีรหัสคูปองแสดงยืนยันตัวตน
          </p>

          <form onSubmit={handleSimulateLead} style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>ชื่อลูกค้า (Customer Name) *</span>
              <input type="text" required value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="เช่น คุณชลธิชา มั่นคง" className="input-field" style={{ padding: '8px' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>เบอร์ติดต่อ (Phone Number)</span>
              <input type="text" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="089-xxxxxxx" className="input-field" style={{ padding: '8px' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>ประเภทออฟไลน์</span>
                <select value={leadType} onChange={(e) => setLeadType(e.target.value)} className="input-field" style={{ padding: '8px' }}>
                  <option value="walk_in">Walk-in เข้าโครงการ</option>
                  <option value="line_addition">แอดมินทาง Line OA</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>รหัสคูปองโฆษณา</span>
                <input
                  type="text"
                  value={leadPromoCode}
                  onChange={(e) => setLeadPromoCode(e.target.value)}
                  placeholder="เช่น RE-FACE-123"
                  className="input-field"
                  style={{ padding: '8px', border: leadPromoCode ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.08)' }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>สถานะปิดการขาย</span>
                <select value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)} className="input-field" style={{ padding: '8px' }}>
                  <option value="showroom_visited">เข้าเยี่ยมโครงการ (Visited)</option>
                  <option value="booking_completed">วางเงินจอง (Booking)</option>
                  <option value="closed_won">โอนกรรมสิทธิ์ปิดการขาย (Closed Won)</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>ยอดวางจอง/เงินหมุนเวียน (THB)</span>
                <input type="number" value={leadRevenue} onChange={(e) => setLeadRevenue(e.target.value)} className="input-field" style={{ padding: '8px' }} />
              </label>
            </div>

            <button
              type="submit"
              disabled={leadSimulating}
              className="btn-primary"
              style={{ padding: '10px', fontSize: '13px', marginTop: '6px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              {leadSimulating ? 'Saving...' : '💾 บันทึกประวัติลูกค้าออฟไลน์นี้'}
            </button>
          </form>
        </section>
      </div>

      {/* 2. Right Side: Journey Attribution Timeline (7 Columns) */}
      <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <section className="glass-card" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
            🏠 เส้นทางการตัดสินใจลูกค้าวิถีอสังหาฯ (Customer Journey Timeline Reports)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            แสดงผลการเชื่อมโยงข้อมูลจากรหัสคูปองออฟไลน์ที่ลูกค้าใช้นำพาไปหารายการกดโฆษณาดิจิทัลต้นทาง (Attribution Analysis)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '680px', paddingRight: '4px' }}>
            {offlineLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                📭 ยังไม่มีรายชื่อลูกค้าออฟไลน์ กรุณากรอกแบบฟอร์มด้านซ้ายเพื่อทดสอบทริกเกอร์ระบบ
              </div>
            ) : (
              offlineLeads.map((lead) => {
                const hasAttribution = !!lead.ad_network

                return (
                  <div key={lead.id} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative'
                  }}>
                    {/* Status Ribbon side */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '15px', color: 'white' }}>{lead.customer_name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          📞 {lead.phone_number || 'N/A'}
                        </span>
                      </div>
                      <span className="badge" style={{
                        background: lead.status === 'closed_won' ? '#10B981' : lead.status === 'booking_completed' ? '#8B5CF6' : '#3B82F6',
                        color: 'white', border: 'none', fontSize: '10px'
                      }}>
                        {lead.status === 'closed_won' ? 'CLOSED WON' : lead.status === 'booking_completed' ? 'BOOKING' : 'VISITED'}
                      </span>
                    </div>

                    {/* Timeline Visual Flow */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: '16px', marginLeft: '6px', position: 'relative' }}>
                      
                      {/* Step 1: Origin Digital Ad Click */}
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '2px', background: hasAttribution ? '#8B5CF6' : 'rgba(255,255,255,0.1)', width: '10px', height: '10px', borderRadius: '50%' }}></span>
                        <div style={{ fontSize: '12px' }}>
                          <strong>จุดเริ่มต้น (Digital Touchpoint): </strong>
                          {hasAttribution ? (
                            <span style={{ color: '#A78BFA', fontWeight: '600' }}>
                              โฆษณา {lead.ad_network.toUpperCase()}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>การเข้าชมเองธรรมชาติ (Direct / Walk-in Organic)</span>
                          )}
                        </div>
                        {hasAttribution && (
                          <div style={{
                            background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', fontSize: '11px', marginTop: '6px',
                            display: 'flex', gap: '10px', alignItems: 'center'
                          }}>
                            {lead.creative_url && (
                              <img src={lead.creative_url} alt="creative" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                            )}
                            <div>
                              <div style={{ color: 'white', fontWeight: '600' }}>แคมเปญ: {lead.campaign_name}</div>
                              <div style={{ color: 'var(--text-muted)' }}>กลุ่มเป้าหมาย: {lead.target_audience}</div>
                              <div style={{ color: 'var(--text-muted)' }}>ชิ้นงานโฆษณา: {lead.ad_name}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Promo Code scanned/used */}
                      <div style={{ position: 'relative', marginTop: '4px' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '2px', background: '#3B82F6', width: '10px', height: '10px', borderRadius: '50%' }}></span>
                        <div style={{ fontSize: '12px' }}>
                          <strong>ปฏิสัมพันธ์ออฟไลน์ (Offline Action): </strong>
                          <span style={{ color: '#93C5FD' }}>
                            {lead.lead_type === 'walk_in' ? 'เดินทางเข้าเยี่ยมชมโครงการ' : 'แอดเพิ่มเพื่อน Line OA'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          รหัสโปรโมชันที่แสดง: <strong style={{ color: 'white', fontFamily: 'var(--font-mono)' }}>{lead.promo_code_used || 'ไม่มี (Direct)'}</strong>
                          {lead.visited_at && ` | วันเวลา: ${new Date(lead.visited_at).toLocaleString()}`}
                        </div>
                      </div>

                      {/* Step 3: Closed deal value */}
                      <div style={{ position: 'relative', marginTop: '4px' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '2px', background: '#10B981', width: '10px', height: '10px', borderRadius: '50%' }}></span>
                        <div style={{ fontSize: '12px' }}>
                          <strong>มูลค่าการซื้อขาย (Closed Deal Value): </strong>
                          <strong style={{ color: '#34D399' }}>
                            ฿{Number(lead.revenue_generated || 0).toLocaleString()} THB
                          </strong>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

    </div>
  )
}
