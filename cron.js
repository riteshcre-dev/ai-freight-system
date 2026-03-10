// workers/cron.js
// ============================================================
// CRON JOBS — Scheduled background tasks
// ============================================================

const cron = require('node-cron');
const logger = require('./utils/logger');
const supabase = require('./config/supabase');

function startCronJobs() {
  // ── Send queued emails every 5 minutes ───────────────────
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[Cron] Running email send batch');
    try {
      const { sendQueuedEmails } = require('../modules/emailAutomation');
      const sent = await sendQueuedEmails(50);
      if (sent > 0) logger.info(`[Cron] Sent ${sent} emails`);
    } catch (err) {
      logger.error('[Cron] Email send error:', err);
    }
  });

  // ── Poll inbox for new replies every 2 minutes ───────────
  cron.schedule('*/2 * * * *', async () => {
    try {
      const { checkInbox } = require('./processors/inboxProcessor');
      await checkInbox();
    } catch (err) {
      logger.error('[Cron] Inbox check error:', err);
    }
  });

  // ── Daily stats report at 8am ─────────────────────────────
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDailyReport();
    } catch (err) {
      logger.error('[Cron] Daily report error:', err);
    }
  });

  // ── Cleanup old notifications (keep 30 days) ─────────────
  cron.schedule('0 0 * * *', async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    await supabase.from('notifications').delete().lt('created_at', cutoff.toISOString());
    logger.info('[Cron] Old notifications cleaned up');
  });

  logger.info('[Cron] All cron jobs scheduled');
}

async function sendDailyReport() {
  const { notifyStage } = require('../modules/notificationEngine');

  // Get today's stats
  const today = new Date().toISOString().split('T')[0];

  const [emails, replies, opportunities, secured] = await Promise.all([
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', `${today}T00:00:00Z`),
    supabase.from('replies').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
    supabase.from('shipment_opportunities').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
    supabase.from('shipment_opportunities').select('*', { count: 'exact', head: true }).eq('is_secured', true).gte('secured_at', `${today}T00:00:00Z`),
  ]);

  await notifyStage('search_started', {
    summary: `📊 Daily Report (${today}):\n• Emails sent: ${emails.count || 0}\n• Replies received: ${replies.count || 0}\n• New opportunities: ${opportunities.count || 0}\n• Loads secured: ${secured.count || 0}`
  });
}

module.exports = { startCronJobs };
