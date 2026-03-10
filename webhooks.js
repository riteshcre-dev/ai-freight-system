// routes/webhooks.js
// Handles SendGrid inbound email + event webhooks
const express = require('express');
const supabase = require('./config/supabase');
const logger = require('./utils/logger');
const { getReplyQueue } = require('../workers/queues');
const router = express.Router();

// POST /api/webhooks/sendgrid/inbound — Inbound email parse
router.post('/sendgrid/inbound', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { from, subject, text, html, headers: rawHeaders } = req.body;

    if (!from || !text) return res.sendStatus(200);

    const fromEmail = extractEmail(from);
    const body = text || stripHtml(html || '');

    // Find contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .eq('email', fromEmail.toLowerCase())
      .single();

    if (!contact) {
      logger.info(`[Webhook] Unknown sender: ${fromEmail}`);
      return res.sendStatus(200);
    }

    // Find original email
    const { data: email } = await supabase
      .from('emails')
      .select('id')
      .eq('contact_id', contact.id)
      .in('status', ['sent', 'opened'])
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    // Save reply
    const { data: reply } = await supabase.from('replies').insert({
      email_id: email?.id || null,
      contact_id: contact.id,
      company_id: contact.company_id,
      raw_body: body.slice(0, 10000),
      from_email: fromEmail.toLowerCase(),
      received_at: new Date().toISOString(),
    }).select().single();

    if (reply) {
      await getReplyQueue().add('analyze_reply', { replyId: reply.id });
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error('[Webhook] Inbound error:', err);
    res.sendStatus(200); // Always 200 to SendGrid
  }
});

// POST /api/webhooks/sendgrid/events — Email open/click events
router.post('/sendgrid/events', (req, res) => {
  const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;

  const events = Array.isArray(body) ? body : [body];

  for (const event of events) {
    handleSendGridEvent(event).catch(err =>
      logger.error('[Webhook] Event handler error:', err)
    );
  }

  res.sendStatus(200);
});

async function handleSendGridEvent(event) {
  const { event: type, email_id } = event;

  if (!email_id) return;

  if (type === 'open') {
    await supabase.from('emails')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', email_id)
      .eq('status', 'sent');
  }
}

function extractEmail(from) {
  const match = from.match(/<(.+?)>/) || [null, from];
  return (match[1] || from).trim();
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = router;
