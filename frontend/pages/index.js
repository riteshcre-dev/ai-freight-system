import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export default function Dashboard() {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searches, setSearches] = useState([]);

  async function runSearch() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif', padding: '40px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>🚛 AI Freight System</h1>
      <p style={{ color: '#888', marginBottom: '32px' }}>Automated load acquisition dashboard</p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        {['search', 'searches'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: tab === t ? '#6c47ff' : '#1a1a1a', color: '#fff', textTransform: 'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {tab === 'search' && (
        <div style={{ maxWidth: '500px' }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Product type (e.g. frozen foods)"
            style={{ width: '100%', padding: '12px', marginBottom: '12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Location (e.g. Chicago, IL)"
            style={{ width: '100%', padding: '12px', marginBottom: '16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
          <button onClick={runSearch} disabled={loading} style={{
            padding: '12px 32px', background: '#6c47ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px'
          }}>{loading ? 'Searching...' : 'Start Search'}</button>
          {result && (
            <pre style={{ marginTop: '24px', background: '#1a1a1a', padding: '16px', borderRadius: '6px', fontSize: '12px', overflow: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
