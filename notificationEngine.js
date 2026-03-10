// modules/notificationEngine.js
// ============================================================
// MODULE 7: NOTIFICATION ENGINE
// Sends email, SMS, and dashboard notifications at every stage
// ============================================================

const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const supabase = require('./config/supabase');
const logger = require('./utils/logger');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const NOTIFICATION_PHONE = process.env.NOTIFICATION_PHONE;
const FROM_EMAIL = process.env.FROM_EMAIL;
const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER;

// Stage definitions
const STAGE_CONFIG = {
  search_started:      { emoji: '🔍', label: 'Search Started',        sms: false },
  shipper_discovered:  { emoji: '🏭', label: 'Shippers Discovered',   sms: false },
  contact_discovered:  { emoji: '👤', label: 'Contacts Found',         sms: false },
  email_generated:     { emoji: '✉️',  label: 'Email Generated',       sms: false },
  email_sent:          { emoji: '📤', label: 'Email Sent',             sms: false },
  reply_received:      { emoji: '📬', label: 'Reply Received',         sms: true  },
  potential_shipment:  { emoji: '🚨', label: 'Potential Shipment!',    sms: true  },
  details_requested:   { emoji: '📋', label: 'Details Requested',      sms: false },
  shipment_secured:    { emoji: '✅', label: 'Shipment SECURED',       sms: true  },
  carrier_ready:       { emoji: '🚛', label: 'Ready for Carrier',      sms: true  },
};

/**
 * Main notification dispatch function
 * Called by all modules at each stage
 */
async function notifyStage(stage, data = {}) {
  const config = STAGE_CONFIG[stage] || { emoji: '📌', label: stage, sms: false };
  logger.info(`[Notify] Stage: ${stage} — ${data.summary || ''}`);

  const message = formatMessage(stage, config, data);

  // ── Store in DB (dashboard notifications) ────────────────
  await saveNotification(stage, message, data);

  // ── Send email notification ───────────────────────────────
  try {
    await sendEmailNotification(config, message, data);
  } catch (err) {
    logger.error('[Notify] Email notification failed:', err.message);
  }

  // ── Send SMS for high-priority stages ────────────────────
  if (config.sms) {
    try {
      await sendSmsNotification(message, data);
    } catch (err) {
      logger.error('[Notify] SMS notification failed:', err.message);
    }
  }
}

/**
 * Send email notification to user
 */
async function sendEmailNotification(config, message, data) {
  if (!NOTIFICATION_EMAIL) return;

  const html = buildEmailHtml(config, data);

  await sgMail.send({
    to: NOTIFICATION_EMAIL,
    from: { email: FROM_EMAIL, name: 'AI Freight System' },
    subject: `${config.emoji} [FreightAI] ${config.label} — ${data.companyName || ''}`,
    text: message,
    html,
  });
}

/**
 * Send SMS notification for high-priority stages
 */
async function sendSmsNotification(message, data) {
  if (!NOTIFICATION_PHONE || !FROM_PHONE) return;

  const smsText = `${message}\n\nAI Freight System`;

  await twilioClient.messages.create({
    body: smsText.slice(0, 1600), // SMS limit
    from: FROM_PHONE,
    to: NOTIFICATION_PHONE,
  });
}

/**
 * Save notification to database (for dashboard)
 */
async function saveNotification(stage, message, data) {
  const rows = [
    { channel: 'dashboard', stage, message, metadata: data },
    { channel: 'email', stage, message, metadata: data },
  ];

  if (STAGE_CONFIG[stage]?.sms) {
    rows.push({ channel: 'sms', stage, message, metadata: data });
  }

  await supabase.from('notifications').insert(
    rows.map(r => ({
      stage,
      channel: r.channel,
      message: r.message,
      subject: `[FreightAI] ${STAGE_CONFIG[stage]?.label || stage}`,
      metadata: data,
      company_id: data.companyId || null,
      contact_id: data.contactId || null,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))
  );
}

// ── Formatters ────────────────────────────────────────────────

function formatMessage(stage, config, data) {
  const lines = [
    `${config.emoji} ${config.label}`,
    '',
  ];

  if (data.companyName)  lines.push(`🏭 Company: ${data.companyName}`);
  if (data.contactName)  lines.push(`👤 Contact: ${data.contactName}`);
  if (data.email)        lines.push(`📧 Email: ${data.email}`);
  if (data.count !== undefined) lines.push(`📊 Count: ${data.count}`);
  if (data.summary)      lines.push(`\n💬 ${data.summary}`);

  if (data.shipmentDetails) {
    const s = data.shipmentDetails;
    lines.push('', '📦 Shipment Details:');
    if (s.pickup)    lines.push(`  📍 Pickup: ${s.pickup}`);
    if (s.delivery)  lines.push(`  📍 Delivery: ${s.delivery}`);
    if (s.commodity) lines.push(`  📦 Commodity: ${s.commodity}`);
    if (s.weight)    lines.push(`  ⚖️  Weight: ${s.weight.toLocaleString()} lbs`);
    if (s.equipment) lines.push(`  🚛 Equipment: ${s.equipment}`);
    if (s.date)      lines.push(`  📅 Pickup Date: ${s.date}`);
  }

  return lines.join('\n');
}

function buildEmailHtml(config, data) {
  const stageColor = {
    shipment_secured: '#10b981',
    potential_shipment: '#f59e0b',
    carrier_ready: '#3b82f6',
    reply_received: '#8b5cf6',
  }[data.stage] || '#6b7280';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:${stageColor};padding:20px;color:white">
      <h2 style="margin:0;font-size:20px">${config.emoji} ${config.label}</h2>
      <p style="margin:4px 0 0;opacity:0.85;font-size:14px">${new Date().toLocaleString()}</p>
    </div>
    <div style="padding:24px">
      ${data.companyName ? `<p><strong>Company:</strong> ${data.companyName}</p>` : ''}
      ${data.contactName ? `<p><strong>Contact:</strong> ${data.contactName}</p>` : ''}
      ${data.email ? `<p><strong>Email:</strong> ${data.email}</p>` : ''}
      ${data.summary ? `<div style="background:#f3f4f6;border-radius:6px;padding:12px;margin:12px 0"><p style="margin:0;color:#374151">${data.summary}</p></div>` : ''}
      ${data.shipmentDetails ? buildShipmentBlock(data.shipmentDetails) : ''}
    </div>
    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">AI Freight Load Acquisition System</p>
    </div>
  </div>
</body>
</html>`;
}

function buildShipmentBlock(s) {
  return `
<div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-top:12px">
  <h3 style="margin:0 0 12px;font-size:16px;color:#111827">📦 Shipment Details</h3>
  <table style="width:100%;border-collapse:collapse">
    ${s.pickup    ? `<tr><td style="padding:4px 0;color:#6b7280;width:120px">Pickup</td><td>${s.pickup}</td></tr>` : ''}
    ${s.delivery  ? `<tr><td style="padding:4px 0;color:#6b7280">Delivery</td><td>${s.delivery}</td></tr>` : ''}
    ${s.commodity ? `<tr><td style="padding:4px 0;color:#6b7280">Commodity</td><td>${s.commodity}</td></tr>` : ''}
    ${s.weight    ? `<tr><td style="padding:4px 0;color:#6b7280">Weight</td><td>${Number(s.weight).toLocaleString()} lbs</td></tr>` : ''}
    ${s.equipment ? `<tr><td style="padding:4px 0;color:#6b7280">Equipment</td><td>${s.equipment}</td></tr>` : ''}
    ${s.date      ? `<tr><td style="padding:4px 0;color:#6b7280">Pickup Date</td><td>${s.date}</td></tr>` : ''}
  </table>
</div>`;
}

module.exports = { notifyStage };
