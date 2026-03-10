// modules/emailGenerator.js
// ============================================================
// MODULE 3: AI EMAIL GENERATOR
// Uses Claude to generate personalized freight outreach emails
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { notifyStage } = require('./notificationEngine');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate personalized email for a contact
 */
async function generateEmail(contact, company, sequenceStep = 1) {
  logger.info(`[EmailGen] Generating email for ${contact.email} (step ${sequenceStep})`);

  const prompt = buildPrompt(contact, company, sequenceStep);

  const message = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }]
  });

  const rawText = message.content[0].text.trim();
  const { subject, body } = parseEmailResponse(rawText);

  // Save to DB
  const { data, error } = await supabase.from('emails').insert({
    contact_id: contact.id,
    company_id: company.id,
    sequence_step: sequenceStep,
    subject,
    body,
    status: 'queued',
    is_followup: sequenceStep > 1,
  }).select().single();

  if (error) throw new Error(`Email save failed: ${error.message}`);

  await notifyStage('email_generated', {
    companyName: company.name,
    contactName: `${contact.first_name} ${contact.last_name}`,
    email: contact.email,
    subject,
    summary: `Generated step-${sequenceStep} email for ${company.name}`
  });

  return data;
}

/**
 * Batch generate emails for multiple contacts
 */
async function generateBatchEmails(contacts) {
  const results = [];

  for (const { contact, company } of contacts) {
    try {
      const email = await generateEmail(contact, company, 1);
      results.push(email);
      await sleep(200); // Respect rate limits
    } catch (err) {
      logger.error(`[EmailGen] Failed for ${contact.email}:`, err.message);
    }
  }

  return results;
}

/**
 * Generate follow-up email based on conversation context
 */
async function generateFollowUp(contact, company, parentEmailId, followupNumber = 1) {
  const step = followupNumber + 1;

  const prompt = buildFollowUpPrompt(contact, company, followupNumber);

  const message = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  const { subject, body } = parseEmailResponse(message.content[0].text.trim());

  const { data, error } = await supabase.from('emails').insert({
    contact_id: contact.id,
    company_id: company.id,
    sequence_step: step,
    subject,
    body,
    status: 'queued',
    is_followup: true,
    parent_email_id: parentEmailId,
  }).select().single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Prompt Builders ───────────────────────────────────────────

function buildPrompt(contact, company, step) {
  const products = company.product_types?.join(', ') || 'products';
  const title = contact.title || 'Logistics Manager';
  const firstName = contact.first_name || 'there';

  return `You are a freight broker writing a cold outreach email to a logistics professional.

Contact: ${firstName} ${contact.last_name || ''}, ${title}
Company: ${company.name}
Industry/Products: ${products}
Location: ${[company.city, company.state].filter(Boolean).join(', ') || 'US'}

Write a personalized freight brokerage cold email. Rules:
- Under 80 words total in the body
- Mention you are a freight broker
- Reference their specific product or industry (${products})
- Offer truckload or port drayage services
- Ask a single yes/no question about upcoming shipments
- Professional but conversational
- No generic phrases like "I hope this email finds you well"

Return ONLY in this exact format:
SUBJECT: [subject line]
BODY:
[email body]`;
}

function buildFollowUpPrompt(contact, company, followupNumber) {
  const firstName = contact.first_name || 'there';
  const products = company.product_types?.join(', ') || 'freight';

  const followupContext = followupNumber === 1
    ? 'This is the first follow-up (3-4 days after initial email).'
    : 'This is the final follow-up (last attempt, 1 week after second email).';

  return `You are a freight broker writing a follow-up email.
${followupContext}

Contact: ${firstName} ${contact.last_name || ''} at ${company.name}
Industry: ${products}

Write a short, non-pushy follow-up. Rules:
- Under 50 words in body
- Reference the previous email briefly
- Keep the door open
- End with an easy question
- No guilt or pressure

Return ONLY:
SUBJECT: [subject]
BODY:
[body]`;
}

// ── Parser ────────────────────────────────────────────────────

function parseEmailResponse(text) {
  const subjectMatch = text.match(/^SUBJECT:\s*(.+)$/m);
  const bodyMatch = text.match(/^BODY:\s*\n([\s\S]+)$/m);

  return {
    subject: subjectMatch?.[1]?.trim() || 'Freight Services for Your Shipments',
    body: bodyMatch?.[1]?.trim() || text,
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { generateEmail, generateBatchEmails, generateFollowUp };
