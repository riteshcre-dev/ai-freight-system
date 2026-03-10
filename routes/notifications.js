const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.get('/', async (req, res) => {
  try { res.json({ success: true, data: [] }); }
  catch (err) { logger.error('Notifications error:', err); res.status(500).json({ error: 'Failed to fetch notifications' }); }
});
router.post('/mark-read', async (req, res) => {
  try { res.json({ success: true }); }
  catch (err) { logger.error('Notifications error:', err); res.status(500).json({ error: 'Failed to update notifications' }); }
});
module.exports = router;
