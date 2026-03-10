// modules/loadSecuringAgent.js
// ============================================================
// MODULE 6: LOAD SECURING AI AGENT
// Continues conversation with shippers to collect all
// shipment details and secure the load
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const sgMail = require('@sendgrid/mail');
const supabase = require('./config/supabase');
const logger = require('./utils/logger');
const { notifyStage } = require('./notificationEngine');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Fields required to secure a load
const REQUIRED_FIELDS = [
  'pickup_location',
  'delivery_location',
  'commodity',
  'weight_lbs',
  'equipment_type',
  'pickup_date',
];

/**
 * Process a new inbound message for an active opportunity
 * and respond to collect missing shipment details
 */
async function processAgentMessage(opportunityId, inboundMessage) {
  logger.info(`[LoadAgent] Processing message for opportunity ${opportunityId}`);

  const { data: opp } = await supabase
    .from('shipment_opportunities')
    .select(`
      *,
      contact:contacts(*),
      company:companies(*)
    `)
    .eq('id', opportunityId)
    .single();

  if (!opp) throw new Error('Opportunity not found');
  if (opp.is_secured) return { status: 'already_secured' };

  // Update conversation history
  const history = [...(opp.conversation_history || []), {
    role: 'shipper',
    content: inboundMessage,
    timestamp: new Date().toISOString()
  }];

  // Extract any new data from this message
  const extracted = await extractShipmentData(inboundMessage, opp);

  // Merge extracted data into opportunity
  const updatedOpp = await updateOpportunityData(opp, extracted);

  // Check if all required fields are collected
  const missingFields = getMissingFields(updatedOpp);

  let agentResponse;
  let isSecured = false;

  if (missingFields.length === 0) {
    // 🎉 All details collected — load is secured!
    agentResponse = await generateLoadConfirmationMessage(updatedOpp);
    isSecured = true;

    await handleLoadSecured(updatedOpp);
  } else {
    // Ask for the next missing field
    agentResponse = await generateDataCollectionResponse(updatedOpp, missingFields, history);
  }

  // Append agent response to history
  history.push({
    role: 'agent',
    content: agentResponse,
    timestamp: new Date().toISOString()
  });

  // Update conversation & stage
  const newStage = isSecured ? 'shipment_secured' : 'details_requested';
  await supabase.from('shipment_opportunities').update({
    conversation_history: history,
    stage: newStage,
    is_secured: isSecured,
    secured_at: isSecured ? new Date().toISOString() : null,
    ...mergeExtracted(extracted),
  }).eq('id', opportunityId);

  // Send reply email
  await sendAgentEmail(opp.contact, opp.company, agentResponse);

  // Notify stage
  await notifyStage(newStage, {
    companyName: opp.company?.name,
    contactName: `${opp.contact?.first_name} ${opp.contact?.last_name}`,
    email: opp.contact?.email,
    summary: isSecured
      ? `✅ Load secured from ${opp.company?.name}!`
      : `Collecting details from ${opp.company?.name} — still need: ${missingFields.join(', ')}`,
    opportunityId,
    missingFields,
  });

  return { agentResponse, isSecured, missingFields, opportunityId };
}

/**
 * Extract shipment data from a message using Claude
 */
async function extractShipmentData(message, currentOpp) {
  const prompt = `Extract freight shipment details from this message.

Current known info:
- Pickup: ${currentOpp.pickup_location || 'unknown'}
- Delivery: ${currentOpp.delivery_location || 'unknown'}
- Commodity: ${currentOpp.commodity || 'unknown'}
- Weight: ${currentOpp.weight_lbs ? currentOpp.weight_lbs + ' lbs' : 'unknown'}
- Equipment: ${currentOpp.equipment_type || 'unknown'}
- Pickup date: ${currentOpp.pickup_date || 'unknown'}

Message: "${message}"

Return ONLY valid JSON (no backticks):
{
  "pickup_location": null,
  "delivery_location": null,
  "commodity": null,
  "weight_lbs": null,
  "equipment_type": null,
  "pickup_date": null,
  "special_requirements": null
}
Only populate fields that are clearly mentioned in the message. Use null for anything not mentioned.`;

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });
    return JSON.parse(response.content[0].text.trim());
  } catch {
    return {};
  }
}

/**
 * Generate a conversational response asking for missing fields
 */
async function generateDataCollectionResponse(opp, missingFields, history) {
  const nextField = missingFields[0];
  const fieldQuestion = FIELD_QUESTIONS[nextField];
  const contactName = opp.contact?.first_name || 'there';
  const historyText = history.slice(-4).map(h => `${h.role === 'agent' ? 'Us' : 'Them'}: ${h.content}`).join('\n');

  const prompt = `You are a friendly freight broker following up on a shipment inquiry.

Contact: ${contactName} at ${opp.company?.name}
Commodity: ${opp.commodity || 'their freight'}

Recent conversation:
${historyText}

You still need to collect: ${missingFields.join(', ')}

The MOST IMPORTANT missing piece right now is: ${nextField}

Write a short, friendly reply email (under 60 words) that:
1. Briefly acknowledges what you know
2. Asks specifically: "${fieldQuestion}"
3. Mentions you want to get them a quote quickly

Return ONLY the email body text, no subject line needed.`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim();
}

/**
 * Generate load confirmation message
 */
async function generateLoadConfirmationMessage(opp) {
  return `Hi ${opp.contact?.first_name},

Thank you! I have all the details I need:
📍 Pickup: ${opp.pickup_location}
📍 Delivery: ${opp.delivery_location}
📦 Commodity: ${opp.commodity} (${opp.weight_lbs?.toLocaleString() || 'TBD'} lbs)
🚛 Equipment: ${opp.equipment_type}
📅 Pickup: ${opp.pickup_date}

I'm working on getting you our best rate and will follow up within the hour with carrier options.

Best regards,
${process.env.FROM_NAME}`;
}

/**
 * Handle when a load is secured
 */
async function handleLoadSecured(opp) {
  await supabase.from('deals').update({
    stage: 'shipment_secured',
  }).eq('opportunity_id', opp.id);

  await notifyStage('carrier_ready', {
    companyName: opp.company?.name,
    contactName: `${opp.contact?.first_name} ${opp.contact?.last_name}`,
    email: opp.contact?.email,
    summary: `🎉 Load secured and ready to assign carrier! ${opp.commodity} from ${opp.pickup_location} to ${opp.delivery_location}`,
    opportunityId: opp.id,
    shipmentDetails: {
      pickup: opp.pickup_location,
      delivery: opp.delivery_location,
      commodity: opp.commodity,
      weight: opp.weight_lbs,
      equipment: opp.equipment_type,
      date: opp.pickup_date,
    }
  });
}

/**
 * Send agent reply email
 */
async function sendAgentEmail(contact, company, body) {
  if (!contact?.email) return;

  try {
    await sgMail.send({
      to: contact.email,
      from: { email: process.env.FROM_EMAIL, name: process.env.FROM_NAME },
      subject: `Re: Freight Services for ${company?.name}`,
      text: body,
    });
  } catch (err) {
    logger.error('[LoadAgent] Email send error:', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────

const FIELD_QUESTIONS = {
  pickup_location: 'What city/state will the freight be picked up from?',
  delivery_location: 'Where does it need to be delivered (city/state)?',
  commodity: 'What commodity or product is being shipped?',
  weight_lbs: 'Approximately how many pounds is the shipment?',
  equipment_type: 'What type of trailer is needed? (Dry van, flatbed, reefer, etc.)',
  pickup_date: 'What is the target pickup date?',
};

function getMissingFields(opp) {
  return REQUIRED_FIELDS.filter(f => !opp[f]);
}

async function updateOpportunityData(opp, extracted) {
  const merged = { ...opp, ...mergeExtracted(extracted) };
  return merged;
}

function mergeExtracted(extracted) {
  const result = {};
  for (const [key, val] of Object.entries(extracted || {})) {
    if (val !== null && val !== undefined) result[key] = val;
  }
  return result;
}

module.exports = { processAgentMessage, extractShipmentData };
