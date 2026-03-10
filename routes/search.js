const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { discoverShippers } = require('../shipperDiscovery');
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('searches').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error('Search fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch searches' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { query, location, companySize, importExport } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const searchId = uuidv4();

    // Save search record
    await supabase.from('searches').insert({
      id: searchId,
      product_type: query,
      location: location || null,
      status: 'running',
      created_at: new Date().toISOString()
    });

    // Run discovery in background
    discoverShippers({ productType: query, location, companySize, importExport }, searchId)
      .catch(err => logger.error('ShipperDiscovery failed:', err));

    res.json({ success: true, searchId, message: 'Search started — you will receive notifications as results come in' });
  } catch (err) {
    logger.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
