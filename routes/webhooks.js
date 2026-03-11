const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  try { logger.info('Webhook received'); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Webhook failed' }); }
});

router.post('/sendgrid/events', async (req, res) => {
  try {
    const events = req.body;
    logger.info('SendGrid events received:', Array.isArray(events) ? events.length : 1);
    res.json({ success: true });
  } catch (err) {
    logger.error('SendGrid events error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/sendgrid/inbound', async (req, res) => {
  try {
    logger.info('SendGrid inbound email received');
    res.json({ success: true });
  } catch (err) {
    logger.error('SendGrid inbound error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
