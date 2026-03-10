const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
router.get('/', async (req, res) => {
  try {
    res.json({ success: true, data: { totalLeads: 0, activeOpportunities: 0, emailsSent: 0, repliesReceived: 0 } });
  } catch (err) { logger.error('Dashboard error:', err); res.status(500).json({ error: 'Failed to fetch dashboard' }); }
});
module.exports = router;
