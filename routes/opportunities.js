const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error('Opportunities error:', err);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

module.exports = router;
