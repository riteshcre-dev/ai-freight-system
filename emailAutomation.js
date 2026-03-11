// modules/emailAutomation.js
// ============================================================
// MODULE 4: EMAIL AUTOMATION ENGINE
// Sends emails via SendGrid with rate limiting, tracking,
// and automatic follow-up scheduling
// ============================================================

const sgMail = require('@sendgrid/mail');
const supabase = require('./config/supabase');
const logger = require('./utils/logger');
const { notifyStage } = require('./notificationEngine');
const { getQueue } = require('./workers/queues');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL;
const FROM_NAME  = process.env.FROM_NAME;
const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || '1000');
const FOLLOWUP_DAYS = parseInt(process.env.FOLLOWUP_DELAY_DAYS || '3');
const MAX_FOLLOWUPS = parseInt(process.env.MAX_FOLLOWUPS || '2');

/**
 * Send a single email
 */
async function sendEmail(emailRecord, contact, company) {
  logger.info(`[EmailAuto] Sending to ${contact.email}`);

  // Check daily limit
  const sentToday = await getDailyCount();
  if (sentToday >= DAILY_LIMIT) {
    logger.warn('[EmailAuto] Daily limit reached, queuing for tomorrow');
    await requeueForTomorrow(emailRecord);
    return null;
  }

  const msg = {
    to: contact.email,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: emailRecord.subject,
    text: emailRecord.body,
    html: textToHtml(emailRecord.body),
    customArgs: {
      email_id: emailRecord.id,
      contact_id: contact.id,
      company_id: company.id,
    },
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  };

  try {
    const [response] = await sgMail.send(msg);

    // Mark as sent
    await supabase.from('emails').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: response.headers['x-message-id'] || null,
    }).eq('id', emailRecord.id);

    // Schedule follow-up
    await scheduleFollowUp(emailRecord, contact, company);

    await notifyStage('email_sent', {
      companyName: company.name,
      contactName: `${contact.first_name} ${contact.last_name}`,
      email: contact.email,
      subject: emailRecord.subject,
      summary: `Email sent to ${contact.first_name} at ${company.name}`
    });

    logger.info(`[EmailAuto] ✅ Sent to ${contact.email}`);
    return true;
  } catch (err) {
    logger.error(`[EmailAuto] SendGrid error for ${contact.email}:`, err.response?.body || err.message);

    await supabase.from('emails').update({ status: 'failed' }).eq('id', emailRecord.id);
    return false;
  }
}

/**
 * Send batch of queued emails
 */
async function sendQueuedEmails(limit = 50) {
  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !emails?.length) {
    logger.info('[EmailAuto] No queued emails found');
    return 0;
  }

  let sent = 0;
  for (const email of emails) {
    // Fetch contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', email.contact_id)
      .single();

    // Fetch company
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', email.company_id)
      .single();

    if (!contact) {
      logger.warn(`[EmailAuto] No contact found for email ${email.id}`);
      continue;
    }

    const success = await sendEmail(email, contact, company || { id: email.company_id, name: 'Unknown' });
    if (success) sent++;
    await sleep(500);
  }

  logger.info(`[EmailAuto] Batch sent: ${sent}/${emails.length}`);
  return sent;
}

/**
 * Schedule a follow-up job
 */
async function scheduleFollowUp(emailRecord, contact, company) {
  // Don't follow up on follow-ups beyond max
  if (emailRecord.sequence_step >= MAX_FOLLOWUPS + 1) return;

  const queue = getQueue('emailQueue');
  if (!queue || !queue.add) {
    logger.info('[EmailAuto] No queue available, skipping follow-up scheduling');
    return;
  }
  const delayMs = FOLLOWUP_DAYS * 24 * 60 * 60 * 1000;

  await queue.add(
    'followup',
    {
      parentEmailId: emailRecord.id,
      contactId: contact.id,
      companyId: company.id,
      followupNumber: emailRecord.sequence_step,
    },
    {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  logger.info(`[EmailAuto] Follow-up scheduled for ${contact.email} in ${FOLLOWUP_DAYS} days`);
}

/**
 * Cancel pending follow-ups when a reply is received
 */
async function cancelFollowUps(emailId) {
  const queue = getQueue('emailQueue');
  if (!queue) return;
  const jobs = await queue.getJobs(['delayed', 'waiting']);

  for (const job of jobs) {
    if (job.data.parentEmailId === emailId) {
      await job.remove();
      logger.info(`[EmailAuto] Cancelled follow-up for email ${emailId}`);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

async function getDailyCount() {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', `${today}T00:00:00Z`);
  return count || 0;
}

async function requeueForTomorrow(emailRecord) {
  const queue = getQueue('emailQueue');
  if (!queue) return;
  const msUntilMidnight = getMsUntilMidnight();
  await queue.add('send_email', { emailId: emailRecord.id }, { delay: msUntilMidnight });
}

function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

function textToHtml(text) {
  return `<html><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px">
    ${text.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
  </body></html>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { sendEmail, sendQueuedEmails, scheduleFollowUp, cancelFollowUps };
