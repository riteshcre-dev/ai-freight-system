const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.get('/', async (req, res) => {
  try { res.json({ success: true, data: [] }); }
  catch (err) { logger.error('Emails error:', err); res.status(500).json({ error: 'Failed to fetch emails' }); }
});
router.post('/send', async (req, res) => {
  try {
    logger.info('Sending email to', req.body.to);
    res.json({ success: true, message: 'Email queued for sending' });
  } catch (err) { logger.error('Email send error:', err); res.status(500).json({ error: 'Failed to send email' }); }
});
module.exports = router;
