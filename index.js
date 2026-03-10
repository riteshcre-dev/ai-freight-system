// ============================================================
// AI Freight Load Acquisition System — Express Server
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { initQueues } = require('./workers/queues');
const { startCronJobs } = require('./workers/cron');

// Routes
const searchRoutes = require('./routes/search');
const contactRoutes = require('./routes/contacts');
const emailRoutes = require('./routes/emails');
const replyRoutes = require('./routes/replies');
const opportunityRoutes = require('./routes/opportunities');
const dashboardRoutes = require('./routes/dashboard');
const webhookRoutes = require('./routes/webhooks');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: ['https://courteous-learning-production.up.railway.app', 'http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true
}));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Raw body for webhooks (before JSON parser)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/search', searchRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/notifications', notificationRoutes);

// ── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start ─────────────────────────────────────────────────────
async function start() {
  try {
    await initQueues();
    logger.info('✅ Job queues initialized');

    startCronJobs();
    logger.info('✅ Cron jobs started');

    app.listen(PORT, () => {
      logger.info(`🚀 AI Freight Backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
