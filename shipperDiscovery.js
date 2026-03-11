// modules/shipperDiscovery.js
// ============================================================
// MODULE 1: SHIPPER DISCOVERY ENGINE
// Finds companies that ship a given product type using
// Google Places API + Apollo.io industry search
// ============================================================

const axios = require('axios');
const supabase = require('./config/supabase');
const logger = require('./utils/logger');
const { notifyStage } = require('./notificationEngine');

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const APOLLO_KEY = process.env.APOLLO_API_KEY;

// ── Product → Industry keyword mapping ──────────────────────
const PRODUCT_INDUSTRY_MAP = {
  'frozen foods':   ['frozen food manufacturer', 'frozen food distributor', 'cold storage'],
  'produce':        ['produce distributor', 'fresh produce', 'agricultural products'],
  'furniture':      ['furniture manufacturer', 'furniture wholesaler', 'home furnishings'],
  'steel':          ['steel manufacturer', 'metal fabricator', 'steel distributor'],
  'beverages':      ['beverage manufacturer', 'bottled drinks', 'beverage distributor'],
  'electronics':    ['electronics manufacturer', 'consumer electronics', 'tech hardware'],
  'automotive':     ['auto parts manufacturer', 'automotive supplier'],
  'chemicals':      ['chemical manufacturer', 'industrial chemicals'],
  'pharmaceuticals':['pharmaceutical manufacturer', 'drug distributor', 'medical supply'],
  'textiles':       ['textile manufacturer', 'apparel manufacturer', 'fabric supplier'],
  'lumber':         ['lumber mill', 'building materials', 'wood products'],
  'food':           ['food manufacturer', 'food distributor', 'grocery distributor'],
};

/**
 * Main discovery function
 * @param {Object} params - { productType, location, companySize, importExport }
 * @param {string} searchId - UUID of the search record
 */
async function discoverShippers({ productType, location, companySize, importExport }, searchId) {
  logger.info(`[ShipperDiscovery] Starting search: ${productType}`);

  const keywords = PRODUCT_INDUSTRY_MAP[productType.toLowerCase()] || [productType + ' manufacturer', productType + ' distributor'];
  const companies = [];

  // ── 1. Google Places ──────────────────────────────────────
  for (const keyword of keywords.slice(0, 3)) {
    const googleResults = await searchGooglePlaces(keyword, location);
    companies.push(...googleResults);
  }

  // ── 2. Apollo Industry Search ─────────────────────────────
  const apolloResults = await searchApolloOrganizations({ productType, location, companySize, importExport });
  companies.push(...apolloResults);

  // ── 3. Deduplicate ────────────────────────────────────────
  const unique = deduplicateCompanies(companies);

  // ── 4. Store in Supabase ──────────────────────────────────
  const saved = await saveCompanies(unique, searchId, productType);

  // ── 5. Update search record ───────────────────────────────
  await supabase.from('searches').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    results_count: saved.length
  }).eq('id', searchId);

  // ── 6. Notify user ────────────────────────────────────────
  await notifyStage('shipper_discovered', {
    searchId,
    productType,
    count: saved.length,
    summary: `Discovered ${saved.length} shippers for "${productType}"`
  });

  logger.info(`[ShipperDiscovery] Found ${saved.length} unique shippers`);
  return saved;
}

// ── Google Places API ────────────────────────────────────────
async function searchGooglePlaces(keyword, location) {
  try {
    const query = location ? `${keyword} near ${location}` : keyword;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;

    const resp = await axios.get(url, {
      params: { query, key: GOOGLE_KEY, type: 'establishment' }
    });

    if (resp.data.status !== 'OK') return [];

    return resp.data.results.map(p => ({
      name: p.name,
      address: p.formatted_address,
      city: extractCity(p.formatted_address),
      state: extractState(p.formatted_address),
      source: 'google_places',
      source_id: p.place_id,
      website: null, // fetched separately if needed
    }));
  } catch (err) {
    logger.error('[ShipperDiscovery] Google Places error:', err.message);
    return [];
  }
}

// ── Apollo.io Organization Search ────────────────────────────
async function searchApolloOrganizations({ productType, location, companySize, importExport }) {
  // Apollo free plan does not support org search — skipping
  logger.info('[ShipperDiscovery] Apollo org search skipped (free plan) — using Google Places only');
  return [];
}

// ── Helpers ───────────────────────────────────────────────────
function deduplicateCompanies(companies) {
  const seen = new Set();
  return companies.filter(c => {
    const key = (c.name || '').toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function saveCompanies(companies, searchId, productType) {
  const rows = companies.map(c => ({
    ...c,
    search_id: searchId,
    product_types: [productType],
  }));

  const { data, error } = await supabase
    .from('companies')
    .upsert(rows, { onConflict: 'name,website', ignoreDuplicates: false })
    .select();

  if (error) {
    logger.error('[ShipperDiscovery] DB save error:', error);
    return [];
  }
  return data || [];
}

function extractCity(address) {
  if (!address) return null;
  const parts = address.split(',');
  return parts.length >= 2 ? parts[parts.length - 3]?.trim() : null;
}

function extractState(address) {
  if (!address) return null;
  const parts = address.split(',');
  const stateZip = parts[parts.length - 2]?.trim() || '';
  return stateZip.split(' ')[0] || null;
}

module.exports = { discoverShippers };
