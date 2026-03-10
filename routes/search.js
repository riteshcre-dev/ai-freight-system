const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.get('/', async (req, res) => {
  try { res.json({ success: true, data: [] }); }
  catch (err) { logger.error('Search error:', err); res.status(500).json({ error: 'Search failed' }); }
});
router.post('/', async (req, res) => {
  try { res.json({ success: true, data: [], query: req.body.query }); }
  catch (err) { logger.error('Search error:', err); res.status(500).json({ error: 'Search failed' }); }
});
module.exports = router;
