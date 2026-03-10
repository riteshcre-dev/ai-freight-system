const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.post('/', async (req, res) => {
  try { logger.info('Webhook received'); res.json({ success: true, received: true }); }
  catch (err) { logger.error('Webhook error:', err); res.status(500).json({ error: 'Webhook failed' }); }
});
router.post('/email', async (req, res) => {
  try { logger.info('Email webhook received'); res.json({ success: true }); }
  catch (err) { logger.error('Email webhook error:', err); res.status(500).json({ error: 'Email webhook failed' }); }
});
module.exports = router;
