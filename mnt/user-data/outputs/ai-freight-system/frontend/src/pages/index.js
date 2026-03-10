// ============================================================
// AI FREIGHT LOAD ACQUISITION SYSTEM — DASHBOARD
// Full Next.js dashboard (pages/index.js)
// ============================================================
// For demo, this is a standalone React component that can be
// embedded in the Next.js app.
// All API calls point to process.env.NEXT_PUBLIC_API_URL

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Search, Truck, Mail, Users, Bell, CheckCircle, AlertCircle,
  TrendingUp, Package, MapPin, RefreshCw, ChevronRight,
  Clock, Zap, Target, Activity, Filter, Play, ArrowRight
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ── API Helpers ───────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Stage colors ──────────────────────────────────────────────
const STAGE_COLORS = {
  search_started:     '#6366f1',
  shipper_discovered: '#8b5cf6',
  contact_discovered: '#0ea5e9',
  email_generated:    '#14b8a6',
  email_sent:         '#22c55e',
  reply_received:     '#f59e0b',
  potential_shipment: '#f97316',
  details_requested:  '#ef4444',
  shipment_secured:   '#10b981',
  carrier_ready:      '#3b82f6',
};

const STAGE_LABELS = {
  search_started:     'Search Started',
  shipper_discovered: 'Shippers Found',
  contact_discovered: 'Contacts Found',
  email_generated:    'Email Generated',
  email_sent:         'Email Sent',
  reply_received:     'Reply Received',
  potential_shipment: 'Potential Shipment',
  details_requested:  'Collecting Details',
  shipment_secured:   '✅ Secured',
  carrier_ready:      '🚛 Carrier Ready',
};

const PRODUCT_TYPES = [
  'Frozen Foods', 'Produce', 'Furniture', 'Steel', 'Beverages',
  'Electronics', 'Automotive', 'Chemicals', 'Pharmaceuticals',
  'Textiles', 'Lumber', 'Food'
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [replies, setReplies] = useState([]);
  const [emailStats, setEmailStats] = useState([]);
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchForm, setSearchForm] = useState({
    productType: '',
    location: '',
    companySize: 'any',
    importExport: false,
  });
  const [searching, setSearching] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [s, notifs, opps, rep, emails, srch] = await Promise.all([
        api('/dashboard/stats').catch(() => null),
        api('/dashboard/notifications').catch(() => []),
        api('/dashboard/opportunities').catch(() => []),
        api('/dashboard/recent-replies').catch(() => []),
        api('/dashboard/email-stats').catch(() => []),
        api('/search').catch(() => []),
      ]);
      if (s) setStats(s);
      setNotifications(notifs || []);
      setOpportunities(opps || []);
      setReplies(rep || []);
      setEmailStats(emails || []);
      setSearches(srch || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  async function runSearch(e) {
    e.preventDefault();
    if (!searchForm.productType) return;
    setSearching(true);
    try {
      await api('/search', {
        method: 'POST',
        body: JSON.stringify({
          productType: searchForm.productType.toLowerCase(),
          location: searchForm.location || undefined,
          companySize: searchForm.companySize === 'any' ? undefined : searchForm.companySize,
          importExport: searchForm.importExport || undefined,
        }),
      });
      setActiveTab('searches');
      setTimeout(fetchData, 1000);
    } catch (err) {
      alert('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1e',
      color: '#e2e8f0',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d1424; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        .tab-btn { transition: all 0.2s; cursor: pointer; border: none; }
        .tab-btn:hover { background: rgba(56, 189, 248, 0.08) !important; }
        .card { transition: transform 0.2s, box-shadow 0.2s; }
        .card:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(56,189,248,0.1); }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .badge-glow { box-shadow: 0 0 12px currentColor; }
        input, select { outline: none; }
        input:focus, select:focus { border-color: #38bdf8 !important; box-shadow: 0 0 0 2px rgba(56,189,248,0.2); }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        borderBottom: '1px solid #1e3a5f',
        background: 'rgba(10,15,30,0.95)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 48 }}>
            <div style={{
              width: 36, height: 36, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Truck size={20} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                FREIGHT AI
              </div>
              <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2 }}>LOAD ACQUISITION</div>
            </div>
          </div>

          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {[
              { id: 'overview', icon: Activity, label: 'Overview' },
              { id: 'search', icon: Search, label: 'New Search' },
              { id: 'searches', icon: Target, label: 'Searches' },
              { id: 'opportunities', icon: Package, label: 'Opportunities' },
              { id: 'emails', icon: Mail, label: 'Emails' },
              { id: 'alerts', icon: Bell, label: `Alerts ${notifications.length > 0 ? `(${notifications.length})` : ''}` },
            ].map(tab => (
              <button key={tab.id} className="tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                  background: activeTab === tab.id ? 'rgba(56,189,248,0.1)' : 'transparent',
                  border: activeTab === tab.id ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: 0.5,
                }}>
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, color: '#475569' }}>
              {lastRefresh.toLocaleTimeString()}
            </div>
            <button onClick={fetchData} style={{
              background: 'transparent', border: '1px solid #1e3a5f',
              borderRadius: 6, padding: '6px 10px', color: '#64748b', cursor: 'pointer',
            }}>
              <RefreshCw size={14} />
            </button>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e',
            }} className="pulse" />
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5 }}>
                Operations Overview
              </h1>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                Real-time freight acquisition pipeline
              </p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'SHIPPERS FOUND', value: stats?.totalCompanies || 0, icon: Users, color: '#8b5cf6', sub: 'companies in pipeline' },
                { label: 'EMAILS SENT', value: stats?.emailsSent || 0, icon: Mail, color: '#0ea5e9', sub: `${stats?.replyRate || 0}% reply rate` },
                { label: 'OPPORTUNITIES', value: stats?.opportunities || 0, icon: Target, color: '#f59e0b', sub: 'active deals' },
                { label: 'LOADS SECURED', value: stats?.secured || 0, icon: CheckCircle, color: '#10b981', sub: 'ready for carriers' },
              ].map(s => (
                <div key={s.label} className="card" style={{
                  background: 'linear-gradient(135deg, #0d1424 0%, #111827 100%)',
                  border: `1px solid rgba(${s.color === '#8b5cf6' ? '139,92,246' : s.color === '#0ea5e9' ? '14,165,233' : s.color === '#f59e0b' ? '245,158,11' : '16,185,129'}, 0.2)`,
                  borderRadius: 12,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, fontWeight: 600 }}>{s.label}</div>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${s.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <s.icon size={16} color={s.color} />
                    </div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                    {s.value.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Email activity chart */}
              <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, fontWeight: 600, marginBottom: 16 }}>EMAIL ACTIVITY</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={emailStats.slice(0, 14).reverse()} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="send_date" tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip contentStyle={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="sent" fill="#0ea5e9" radius={[3,3,0,0]} name="Sent" />
                    <Bar dataKey="replied" fill="#10b981" radius={[3,3,0,0]} name="Replied" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pipeline pie */}
              <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, fontWeight: 600, marginBottom: 16 }}>PIPELINE STAGES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {[
                    { label: 'Emails Sent', value: stats?.emailsSent || 0, color: '#0ea5e9' },
                    { label: 'Replies', value: stats?.totalReplies || 0, color: '#f59e0b' },
                    { label: 'Opportunities', value: stats?.opportunities || 0, color: '#f97316' },
                    { label: 'Secured', value: stats?.secured || 0, color: '#10b981' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.value}</span>
                      </div>
                      <div style={{ height: 4, background: '#1e3a5f', borderRadius: 2 }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (item.value / Math.max(stats?.emailsSent || 1, 1)) * 100)}%`,
                          background: item.color,
                          borderRadius: 2,
                          transition: 'width 0.5s',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent replies + Opportunities */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Recent replies */}
              <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, fontWeight: 600, marginBottom: 16 }}>
                  RECENT REPLIES
                </div>
                {replies.slice(0, 6).map(reply => (
                  <div key={reply.id} style={{
                    padding: '10px 0',
                    borderBottom: '1px solid #1e3a5f',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                      background: STAGE_COLORS[reply.classification] || '#64748b',
                    }} className={reply.classification === 'potential_shipment' ? 'pulse' : ''} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                          {reply.company?.name || 'Unknown'}
                        </span>
                        <span style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: `${STAGE_COLORS[reply.classification] || '#64748b'}20`,
                          color: STAGE_COLORS[reply.classification] || '#64748b',
                        }}>
                          {reply.classification?.replace(/_/g, ' ') || 'unclassified'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {reply.contact?.first_name} {reply.contact?.last_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {reply.ai_summary || reply.raw_body?.slice(0, 80)}
                      </div>
                    </div>
                  </div>
                ))}
                {replies.length === 0 && <Empty text="No replies yet" />}
              </div>

              {/* Active opportunities */}
              <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, fontWeight: 600, marginBottom: 16 }}>
                  ACTIVE OPPORTUNITIES
                </div>
                {opportunities.slice(0, 6).map(opp => (
                  <div key={opp.id} style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    background: '#111827',
                    border: `1px solid ${opp.is_secured ? '#10b98130' : '#1e3a5f'}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                        {opp.company_name || 'Unknown'}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10,
                        background: opp.is_secured ? '#10b98120' : '#f5900020',
                        color: opp.is_secured ? '#10b981' : '#f59e0b',
                        fontWeight: 600,
                      }}>
                        {opp.is_secured ? '✅ SECURED' : STAGE_LABELS[opp.stage] || opp.stage}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', gap: 12 }}>
                      {opp.pickup_location && <span>📍 {opp.pickup_location}</span>}
                      {opp.delivery_location && <span>→ {opp.delivery_location}</span>}
                    </div>
                    {opp.commodity && (
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        📦 {opp.commodity}{opp.weight_lbs ? ` · ${Number(opp.weight_lbs).toLocaleString()} lbs` : ''}
                      </div>
                    )}
                  </div>
                ))}
                {opportunities.length === 0 && <Empty text="No active opportunities" />}
              </div>
            </div>
          </div>
        )}

        {/* ── NEW SEARCH TAB ── */}
        {activeTab === 'search' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Search size={28} color="white" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                Launch Shipper Search
              </h2>
              <p style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
                AI will find shippers, discover contacts, and send personalized outreach automatically
              </p>
            </div>

            <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 16, padding: 28 }}>
              <form onSubmit={runSearch}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
                    PRODUCT TYPE *
                  </label>
                  <select
                    value={searchForm.productType}
                    onChange={e => setSearchForm(p => ({ ...p, productType: e.target.value }))}
                    required
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: '#111827', border: '1px solid #1e3a5f',
                      borderRadius: 8, color: '#e2e8f0', fontSize: 13,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    <option value="">Select product type...</option>
                    {PRODUCT_TYPES.map(p => (
                      <option key={p} value={p.toLowerCase()}>{p}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
                    LOCATION (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chicago, IL or Texas"
                    value={searchForm.location}
                    onChange={e => setSearchForm(p => ({ ...p, location: e.target.value }))}
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: '#111827', border: '1px solid #1e3a5f',
                      borderRadius: 8, color: '#e2e8f0', fontSize: 13,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
                      COMPANY SIZE
                    </label>
                    <select
                      value={searchForm.companySize}
                      onChange={e => setSearchForm(p => ({ ...p, companySize: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px',
                        background: '#111827', border: '1px solid #1e3a5f',
                        borderRadius: 8, color: '#e2e8f0', fontSize: 13,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      <option value="any">Any size</option>
                      <option value="small">Small (1–50)</option>
                      <option value="medium">Medium (51–500)</option>
                      <option value="large">Large (500+)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
                      FILTER
                    </label>
                    <select
                      value={searchForm.importExport ? 'true' : 'false'}
                      onChange={e => setSearchForm(p => ({ ...p, importExport: e.target.value === 'true' }))}
                      style={{
                        width: '100%', padding: '12px 14px',
                        background: '#111827', border: '1px solid #1e3a5f',
                        borderRadius: 8, color: '#e2e8f0', fontSize: 13,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      <option value="false">All companies</option>
                      <option value="true">Import/Export only</option>
                    </select>
                  </div>
                </div>

                {/* Pipeline preview */}
                <div style={{ background: '#111827', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>AUTOMATED PIPELINE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {['Find Shippers', 'Find Contacts', 'Generate Emails', 'Send Outreach', 'Monitor Replies', 'Secure Loads'].map((step, i, arr) => (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b', padding: '3px 8px', background: '#1e3a5f30', borderRadius: 4 }}>
                          {step}
                        </span>
                        {i < arr.length - 1 && <ArrowRight size={10} color="#334155" />}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={searching || !searchForm.productType}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: searching ? '#1e3a5f' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: searching ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    letterSpacing: 1,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {searching ? (
                    <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> LAUNCHING SEARCH...</>
                  ) : (
                    <><Play size={16} /> LAUNCH AI SEARCH</>
                  )}
                </button>
              </form>
            </div>

            {/* Process steps */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '🔍', title: 'Discover', desc: 'Finds companies shipping your product using Google Places & Apollo' },
                { icon: '👤', title: 'Contacts', desc: 'Identifies logistics managers & decision makers with verified emails' },
                { icon: '✉️', title: 'Outreach', desc: 'Claude AI writes personalized emails under 80 words each' },
                { icon: '🤖', title: 'Auto-Follow', desc: 'Sends follow-ups and monitors replies 24/7 automatically' },
              ].map(step => (
                <div key={step.title} style={{
                  background: '#0d1424',
                  border: '1px solid #1e3a5f',
                  borderRadius: 10,
                  padding: 14,
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{step.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCHES TAB ── */}
        {activeTab === 'searches' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                Search History
              </h2>
              <button onClick={() => setActiveTab('search')} style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                border: 'none', color: 'white', cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                + New Search
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {searches.map(search => (
                <div key={search.id} style={{
                  background: '#0d1424',
                  border: '1px solid #1e3a5f',
                  borderRadius: 10,
                  padding: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: '#1e3a5f',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Search size={18} color="#38bdf8" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>
                        {search.product_type}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {search.location_filter && `📍 ${search.location_filter} · `}
                        {new Date(search.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {search.results_count || 0}
                      </div>
                      <div style={{ fontSize: 10, color: '#475569' }}>SHIPPERS</div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 10, fontWeight: 600,
                      background: search.status === 'completed' || search.status === 'emails_queued' ? '#10b98120' :
                                  search.status === 'running' ? '#f59e0b20' : '#ef444420',
                      color: search.status === 'completed' || search.status === 'emails_queued' ? '#10b981' :
                             search.status === 'running' ? '#f59e0b' : '#ef4444',
                    }}>
                      {search.status}
                    </span>
                  </div>
                </div>
              ))}
              {searches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                  <Search size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 13 }}>No searches yet. Launch your first search!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES TAB ── */}
        {activeTab === 'opportunities' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                Shipment Opportunities
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {opportunities.map(opp => (
                <div key={opp.id} style={{
                  background: '#0d1424',
                  border: `1px solid ${opp.is_secured ? '#10b98140' : '#1e3a5f'}`,
                  borderRadius: 12,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {opp.company_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        {opp.contact_name} · {opp.contact_email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 11, padding: '4px 12px', borderRadius: 10, fontWeight: 700,
                        background: opp.is_secured ? '#10b98120' : `${STAGE_COLORS[opp.stage] || '#475569'}20`,
                        color: opp.is_secured ? '#10b981' : STAGE_COLORS[opp.stage] || '#94a3b8',
                      }}>
                        {opp.is_secured ? '✅ SECURED' : STAGE_LABELS[opp.stage] || opp.stage}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'PICKUP', value: opp.pickup_location, icon: '📍' },
                      { label: 'DELIVERY', value: opp.delivery_location, icon: '📍' },
                      { label: 'COMMODITY', value: opp.commodity, icon: '📦' },
                      { label: 'WEIGHT', value: opp.weight_lbs ? `${Number(opp.weight_lbs).toLocaleString()} lbs` : null, icon: '⚖️' },
                      { label: 'EQUIPMENT', value: opp.equipment_type, icon: '🚛' },
                      { label: 'PICKUP DATE', value: opp.pickup_date, icon: '📅' },
                    ].map(field => (
                      <div key={field.label} style={{
                        background: '#111827',
                        border: '1px solid #1e3a5f',
                        borderRadius: 8,
                        padding: '8px 12px',
                      }}>
                        <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, marginBottom: 4 }}>{field.label}</div>
                        <div style={{ fontSize: 12, color: field.value ? '#e2e8f0' : '#334155' }}>
                          {field.value ? `${field.icon} ${field.value}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {opportunities.length === 0 && <Empty text="No opportunities yet. Replies will generate opportunities automatically." />}
            </div>
          </div>
        )}

        {/* ── EMAILS TAB ── */}
        {activeTab === 'emails' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                Email Activity
              </h2>
            </div>

            {/* Email metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'SENT', value: stats?.emailsSent || 0, color: '#0ea5e9' },
                { label: 'REPLIES', value: stats?.totalReplies || 0, color: '#10b981' },
                { label: 'REPLY RATE', value: `${stats?.replyRate || 0}%`, color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{
                  background: '#0d1424',
                  border: `1px solid ${m.color}30`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: m.color, fontFamily: "'Space Grotesk', sans-serif" }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Email stats table */}
            <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5f' }}>
                <span style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, fontWeight: 600 }}>DAILY BREAKDOWN</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                    {['Date', 'Sent', 'Opened', 'Replied', 'Open Rate', 'Reply Rate'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, color: '#475569', letterSpacing: 2, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emailStats.slice(0, 15).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #111827' }}>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#94a3b8' }}>{row.send_date}</td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{row.sent}</td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#0ea5e9' }}>{row.opened || 0}</td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#10b981' }}>{row.replied || 0}</td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#64748b' }}>{row.open_rate || 0}%</td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#64748b' }}>{row.reply_rate || 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {emailStats.length === 0 && <Empty text="No email data yet" />}
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {activeTab === 'alerts' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', fontFamily: "'Space Grotesk', sans-serif" }}>
                System Notifications
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.map(notif => (
                <div key={notif.id} style={{
                  background: '#0d1424',
                  border: `1px solid ${STAGE_COLORS[notif.stage] || '#1e3a5f'}30`,
                  borderLeft: `3px solid ${STAGE_COLORS[notif.stage] || '#1e3a5f'}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      color: STAGE_COLORS[notif.stage] || '#94a3b8',
                    }}>
                      {STAGE_LABELS[notif.stage] || notif.stage}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569' }}>
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {notif.message}
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <Empty text="No notifications yet. Start a search to begin." />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#334155', fontSize: 12 }}>
      {text}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64,
          border: '2px solid #1e3a5f',
          borderTop: '2px solid #0ea5e9',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px',
        }} />
        <div style={{ color: '#38bdf8', fontSize: 14, letterSpacing: 2 }}>FREIGHT AI</div>
        <div style={{ color: '#334155', fontSize: 11, marginTop: 6 }}>Loading dashboard...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
