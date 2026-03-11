const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const [searches, contacts, opportunities] = await Promise.all([
      supabase.from('searches').select('id', { count: 'exact' }),
      supabase.from('contacts').select('id', { count: 'exact' }),
      supabase.from('opportunities').select('id', { count: 'exact' }).catch(() => ({ count: 0 })),
    ]);
    res.json({
      success: true,
      data: {
        totalSearches: searches.count || 0,
        totalContacts: contacts.count || 0,
        totalOpportunities: opportunities.count || 0,
      }
    });
  } catch (err) {
    logger.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

module.exports = router;
