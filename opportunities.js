// routes/opportunities.js
const express = require('express');
const supabase = require('../config/supabase');
const { getAgentQueue } = require('../workers/queues');
const router = express.Router();

// GET /api/opportunities
router.get('/', async (req, res) => {
  const { stage, secured } = req.query;
  let query = supabase.from('shipment_opportunities')
    .select(`*, contact:contacts(*), company:companies(*)`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (stage) query = query.eq('stage', stage);
  if (secured !== undefined) query = query.eq('is_secured', secured === 'true');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/opportunities/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('shipment_opportunities')
    .select(`*, contact:contacts(*), company:companies(*), reply:replies(*)`)
    .eq('id', req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// POST /api/opportunities/:id/message — Manually trigger agent
router.post('/:id/message', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const job = await getAgentQueue().add('agent_message', {
    opportunityId: req.params.id,
    message,
  });

  res.json({ jobId: job.id, status: 'queued' });
});

// PATCH /api/opportunities/:id — Update opportunity details
router.patch('/:id', async (req, res) => {
  const allowed = ['pickup_location', 'delivery_location', 'commodity', 'weight_lbs', 'equipment_type', 'pickup_date', 'estimated_rate', 'notes', 'carrier_assigned'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const { data, error } = await supabase
    .from('shipment_opportunities')
    .update(updates)
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/opportunities/:id/secure — Mark as secured
router.post('/:id/secure', async (req, res) => {
  const { data, error } = await supabase
    .from('shipment_opportunities')
    .update({ is_secured: true, secured_at: new Date().toISOString(), stage: 'shipment_secured' })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
