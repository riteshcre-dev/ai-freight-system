// modules/contactDiscovery.js
// ============================================================
// MODULE 2: CONTACT DISCOVERY ENGINE
// Finds logistics/supply chain decision-makers at each company
// using Apollo.io + Hunter.io
// ============================================================

const axios = require('axios');
const supabase = require('./config/supabase');
const logger = require('./utils/logger');
const { notifyStage } = require('./notificationEngine');
const { generateBatchEmails } = require('./emailGenerator');

const APOLLO_KEY = process.env.APOLLO_API_KEY;
const HUNTER_KEY = process.env.HUNTER_API_KEY;

const TARGET_TITLES = [
  'Logistics Manager',
  'Supply Chain Manager',
  'Transportation Manager',
  'Operations Manager',
  'Director of Logistics',
  'Director of Supply Chain',
  'VP of Logistics',
  'VP Supply Chain',
  'Head of Logistics',
  'Shipping Manager',
  'Freight Manager',
  'Director of Transportation',
  'Procurement Manager',
];

/**
 * Find contacts for a list of companies
 */
async function discoverContacts(companies) {
  logger.info(`[ContactDiscovery] Processing ${companies.length} companies`);
  const allContacts = [];

  for (const company of companies) {
    try {
      const contacts = await findContactsForCompany(company);
      allContacts.push(...contacts);

      // Throttle API calls
      await sleep(2000); // Hunter free plan: max 25 requests/month, slow down
    } catch (err) {
      logger.error(`[ContactDiscovery] Error for ${company.name}:`, err.message);
    }
  }

  // Save all contacts
  const saved = await saveContacts(allContacts);

  await notifyStage('contact_discovered', {
    count: saved.length,
    companies: companies.length,
    summary: `Found ${saved.length} logistics contacts across ${companies.length} companies`
  });

  // Auto-trigger email generation in background
  if (saved.length > 0) {
    const contactsWithCompanies = saved.map(c => ({
      contact: c,
      company: companies.find(co => co.id === c.company_id) || { id: c.company_id, name: 'Unknown' }
    }));
    generateBatchEmails(contactsWithCompanies)
      .catch(err => logger.error('[ContactDiscovery] Email generation failed:', err));
  }

  return saved;
}

/**
 * Find contacts for a single company
 */
async function findContactsForCompany(company) {
  const contacts = [];

  // ── Try Apollo first ──────────────────────────────────────
  const apolloContacts = await searchApolloContacts(company);
  contacts.push(...apolloContacts);

  // ── Try Hunter.io domain search ──────────────────────────
  const domain = company.website ? extractDomain(company.website) : guessWebsite(company.name);
  if (domain) {
    const hunterContacts = await searchHunterDomain(domain, company);
    contacts.push(...hunterContacts);
  }

  return contacts;
}

// ── Apollo People Search ──────────────────────────────────────
async function searchApolloContacts(company) {
  // Apollo free plan does not support people search — skipping
  return [];
}

// ── Hunter.io Domain Search ───────────────────────────────────
async function searchHunterDomain(domain, company) {
  try {
    const resp = await axios.get('https://api.hunter.io/v2/domain-search', {
      params: {
        domain,
        api_key: HUNTER_KEY,
        limit: 10,
        type: 'personal',
      }
    });

    const emails = resp.data?.data?.emails || [];

    // Filter to relevant titles
    return emails
      .filter(e => isRelevantTitle(e.position))
      .slice(0, 3)
      .map(e => ({
        company_id: company.id,
        first_name: e.first_name,
        last_name: e.last_name,
        title: e.position,
        email: e.value,
        source: 'hunter',
        confidence_score: (e.confidence || 50) / 100,
        is_verified: e.verification?.status === 'valid',
      }));
  } catch (err) {
    logger.error(`[ContactDiscovery] Hunter error for ${domain}:`, err.message);
    return [];
  }
}

// ── Save to Supabase ──────────────────────────────────────────
async function saveContacts(contacts) {
  if (contacts.length === 0) return [];

  const { data, error } = await supabase
    .from('contacts')
    .upsert(contacts, { onConflict: 'email', ignoreDuplicates: false })
    .select();

  if (error) {
    logger.error('[ContactDiscovery] DB save error:', error);
    return [];
  }
  return data || [];
}

// ── Helpers ───────────────────────────────────────────────────
function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function isRelevantTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return TARGET_TITLES.some(t => lower.includes(t.toLowerCase().split(' ')[0]));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function guessWebsite(name) {
  if (!name) return null;
  const cleaned = name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(' ')[0];
  return cleaned + '.com';
}

module.exports = { discoverContacts, findContactsForCompany };
