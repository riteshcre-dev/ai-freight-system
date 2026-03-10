// routes/dashboard.js
const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: totalCompanies },
      { count: totalContacts },
      { count: emailsSent },
      { count: totalReplies },
      { count: opportunities },
      { count: secured },
    ] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('emails').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('replies').select('*', { count: 'exact', head: true }),
      supabase.from('shipment_opportunities').select('*', { count: 'exact', head: true }),
      supabase.from('shipment_opportunities').select('*', { count: 'exact', head: true }).eq('is_secured', true),
    ]);

    const replyRate = emailsSent > 0 ? ((totalReplies / emailsSent) * 100).toFixed(1) : 0;

    res.json({
      totalCompanies: totalCompanies || 0,
      totalContacts: totalContacts || 0,
      emailsSent: emailsSent || 0,
      totalReplies: totalReplies || 0,
      replyRate: parseFloat(replyRate),
      opportunities: opportunities || 0,
      secured: secured || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/pipeline
router.get('/pipeline', async (req, res) => {
  const { data, error } = await supabase.from('pipeline_summary').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/dashboard/opportunities
router.get('/opportunities', async (req, res) => {
  const { data, error } = await supabase
    .from('active_opportunities')
    .select('*')
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/dashboard/email-stats
router.get('/email-stats', async (req, res) => {
  const { data, error } = await supabase.from('email_stats').select('*').limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/dashboard/notifications
router.get('/notifications', async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('channel', 'dashboard')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/dashboard/recent-replies
router.get('/recent-replies', async (req, res) => {
  const { data, error } = await supabase
    .from('replies')
    .select(`
      *,
      contact:contacts(first_name, last_name, email),
      company:companies(name)
    `)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
