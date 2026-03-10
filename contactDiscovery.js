// modules/contactDiscovery.js
// ============================================================
// MODULE 2: CONTACT DISCOVERY ENGINE
// Finds logistics/supply chain decision-makers at each company
// using Apollo.io + Hunter.io
// ============================================================

const axios = require('axios');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { notifyStage } = require('./notificationEngine');

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
      await sleep(300);
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

  // ── If no results, try Hunter.io domain search ────────────
  if (contacts.length === 0 && company.website) {
    const domain = extractDomain(company.website);
    const hunterContacts = await searchHunterDomain(domain, company);
    contacts.push(...hunterContacts);
  }

  return contacts;
}

// ── Apollo People Search ──────────────────────────────────────
async function searchApolloContacts(company) {
  try {
    const payload = {
      api_key: APOLLO_KEY,
      q_organization_name: company.name,
      person_titles: TARGET_TITLES,
      page: 1,
      per_page: 5,
    };

    if (company.website) {
      payload.q_organization_domains = [extractDomain(company.website)];
    }

    const resp = await axios.post(
      'https://api.apollo.io/v1/mixed_people/search',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    return (resp.data.people || [])
      .filter(p => p.email) // only with verified emails
      .map(p => ({
        company_id: company.id,
        first_name: p.first_name,
        last_name: p.last_name,
        title: p.title,
        email: p.email,
        phone: p.phone_numbers?.[0]?.raw_number,
        linkedin_url: p.linkedin_url,
        source: 'apollo',
        confidence_score: p.email_status === 'verified' ? 0.95 : 0.70,
        is_verified: p.email_status === 'verified',
      }));
  } catch (err) {
    logger.error(`[ContactDiscovery] Apollo contact error for ${company.name}:`, err.message);
    return [];
  }
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

module.exports = { discoverContacts, findContactsForCompany };
