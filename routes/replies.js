const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.get('/', async (req, res) => {
  try { res.json({ success: true, data: [] }); }
  catch (err) { logger.error('Replies error:', err); res.status(500).json({ error: 'Failed to fetch replies' }); }
});
router.post('/', async (req, res) => {
  try { res.status(201).json({ success: true, data: req.body }); }
  catch (err) { logger.error('Replies error:', err); res.status(500).json({ error: 'Failed to create reply' }); }
});
module.exports = router;
