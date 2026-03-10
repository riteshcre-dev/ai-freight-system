// routes/search.js
const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./config/supabase');
const { getSearchQueue } = require('../workers/queues');
const router = express.Router();

const SearchSchema = z.object({
  productType: z.string().min(2).max(100),
  location: z.string().optional(),
  companySize: z.enum(['small', 'medium', 'large', 'any']).optional(),
  importExport: z.boolean().optional(),
});

// POST /api/search — Start a new search
router.post('/', async (req, res) => {
  try {
    const params = SearchSchema.parse(req.body);

    // Create search record
    const searchId = uuidv4();
    const { data: search, error } = await supabase.from('searches').insert({
      id: searchId,
      product_type: params.productType,
      location_filter: params.location,
      company_size_filter: params.companySize,
      import_export_filter: params.importExport,
      status: 'running',
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    // Queue the search job
    const queue = getSearchQueue();
    const job = await queue.add('run_search', { ...params, searchId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    res.json({ searchId, jobId: job.id, status: 'running', message: 'Search started' });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search — List all searches
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('searches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/search/:id — Get search status + results
router.get('/:id', async (req, res) => {
  const { data: search } = await supabase.from('searches').select('*').eq('id', req.params.id).single();
  if (!search) return res.status(404).json({ error: 'Search not found' });

  const { data: companies } = await supabase
    .from('companies')
    .select(`*, contacts(*)`)
    .eq('search_id', req.params.id);

  res.json({ search, companies: companies || [] });
});

module.exports = router;
