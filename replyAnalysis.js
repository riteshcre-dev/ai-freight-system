// modules/replyAnalysis.js
// ============================================================
// MODULE 5: AI REPLY ANALYSIS ENGINE
// Uses Claude to classify replies and extract shipment data
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { notifyStage } = require('./notificationEngine');
const { cancelFollowUps } = require('./emailAutomation');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyze and classify an inbound reply
 */
async function analyzeReply(replyId) {
  logger.info(`[ReplyAnalysis] Processing reply ${replyId}`);

  const { data: reply, error } = await supabase
    .from('replies')
    .select(`
      *,
      email:emails(*),
      contact:contacts(*),
      company:companies(*)
    `)
    .eq('id', replyId)
    .single();

  if (error || !reply) {
    logger.error('[ReplyAnalysis] Reply not found:', replyId);
    return null;
  }

  // Cancel follow-up since we got a reply
  if (reply.email_id) await cancelFollowUps(reply.email_id);

  // Classify with Claude
  const analysis = await classifyWithClaude(reply.raw_body);

  // Update reply record
  await supabase.from('replies').update({
    classification: analysis.classification,
    ai_confidence: analysis.confidence,
    ai_summary: analysis.summary,
    ai_extracted_data: analysis.extractedData,
    processed_at: new Date().toISOString(),
  }).eq('id', replyId);

  // Mark original email as replied
  if (reply.email_id) {
    await supabase.from('emails').update({
      status: 'replied',
      replied_at: new Date().toISOString()
    }).eq('id', reply.email_id);
  }

  // ── Stage-specific notifications ─────────────────────────
  await notifyStage('reply_received', {
    companyName: reply.company?.name,
    contactName: reply.contact ? `${reply.contact.first_name} ${reply.contact.last_name}` : 'Unknown',
    email: reply.from_email,
    summary: `Reply received: "${analysis.summary}"`,
    classification: analysis.classification,
  });

  // If potential shipment, trigger Load Securing Agent
  if (['potential_shipment', 'shipment_opportunity'].includes(analysis.classification)) {
    await notifyStage('potential_shipment', {
      companyName: reply.company?.name,
      contactName: reply.contact ? `${reply.contact.first_name} ${reply.contact.last_name}` : 'Unknown',
      email: reply.from_email,
      summary: `🚨 Shipment opportunity detected at ${reply.company?.name}! "${analysis.summary}"`,
      extractedData: analysis.extractedData,
    });

    // Create opportunity record
    await createOpportunity(reply, analysis);
  }

  return analysis;
}

/**
 * Classify reply using Claude
 */
async function classifyWithClaude(emailBody) {
  const prompt = `You are an AI assistant for a freight brokerage. Analyze this email reply and classify it.

EMAIL CONTENT:
"""
${emailBody}
"""

Classify this reply as exactly ONE of:
- not_interested: They said no, unsubscribe, or clearly don't want contact
- general_inquiry: Curious but no specific need mentioned
- potential_shipment: They mentioned freight, shipping, loads, rates, or showed interest
- shipment_opportunity: They have a specific shipment need with some details

Also extract any shipment details if present.

Return ONLY valid JSON (no markdown, no backticks):
{
  "classification": "not_interested|general_inquiry|potential_shipment|shipment_opportunity",
  "confidence": 0.0-1.0,
  "summary": "1-2 sentence summary",
  "extractedData": {
    "pickupLocation": null,
    "deliveryLocation": null,
    "commodity": null,
    "weightLbs": null,
    "equipmentType": null,
    "pickupDate": null,
    "rateRequest": false
  },
  "keyPhrases": ["phrase1", "phrase2"]
}`;

  try {
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text.trim();
    const parsed = JSON.parse(text);

    return {
      classification: parsed.classification || 'unclassified',
      confidence: parsed.confidence || 0.5,
      summary: parsed.summary || 'Reply received',
      extractedData: parsed.extractedData || {},
      keyPhrases: parsed.keyPhrases || [],
    };
  } catch (err) {
    logger.error('[ReplyAnalysis] Claude error:', err.message);

    // Fallback: simple keyword classification
    return fallbackClassify(emailBody);
  }
}

/**
 * Fallback keyword-based classification
 */
function fallbackClassify(body) {
  const lower = body.toLowerCase();

  const notInterestedKw = ['unsubscribe', 'not interested', 'remove me', 'do not contact', 'stop emailing'];
  const shipmentKw = ['shipment', 'freight', 'load', 'truckload', 'rate', 'quote', 'pickup', 'delivery', 'shipping'];

  if (notInterestedKw.some(kw => lower.includes(kw))) {
    return { classification: 'not_interested', confidence: 0.9, summary: 'Contact opted out', extractedData: {} };
  }
  if (shipmentKw.filter(kw => lower.includes(kw)).length >= 2) {
    return { classification: 'potential_shipment', confidence: 0.6, summary: 'Possible freight interest detected', extractedData: {} };
  }
  return { classification: 'general_inquiry', confidence: 0.5, summary: 'General response received', extractedData: {} };
}

/**
 * Create shipment opportunity from reply
 */
async function createOpportunity(reply, analysis) {
  const extracted = analysis.extractedData || {};

  const { data: opp } = await supabase.from('shipment_opportunities').insert({
    reply_id: reply.id,
    company_id: reply.company_id,
    contact_id: reply.contact_id,
    stage: 'potential_shipment',
    pickup_location: extracted.pickupLocation,
    delivery_location: extracted.deliveryLocation,
    commodity: extracted.commodity,
    weight_lbs: extracted.weightLbs,
    equipment_type: extracted.equipmentType,
    pickup_date: extracted.pickupDate,
    conversation_history: [{
      role: 'shipper',
      content: reply.raw_body,
      timestamp: reply.received_at
    }]
  }).select().single();

  // Create/update deal
  if (opp) {
    await supabase.from('deals').upsert({
      company_id: reply.company_id,
      contact_id: reply.contact_id,
      opportunity_id: opp.id,
      stage: 'potential_shipment',
      stage_history: [{ stage: 'potential_shipment', timestamp: new Date().toISOString() }]
    });
  }

  return opp;
}

module.exports = { analyzeReply, classifyWithClaude };
