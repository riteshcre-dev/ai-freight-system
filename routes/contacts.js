const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, companies(name, city, state)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error('Contacts fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

module.exports = router;
