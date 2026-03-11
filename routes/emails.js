const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const supabase = require('../config/supabase');
const { generateBatchEmails } = require('../emailGenerator');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*, contacts(first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error('Emails fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*, companies(*)')
      .limit(50);
    if (error) throw error;
    if (!contacts || contacts.length === 0) {
      return res.json({ success: true, message: 'No contacts to email' });
    }
    const contactsWithCompanies = contacts.map(c => ({
      contact: c,
      company: c.companies || { id: c.company_id, name: 'Unknown' }
    }));
    generateBatchEmails(contactsWithCompanies)
      .catch(err => logger.error('Batch email generation failed:', err));
    res.json({ success: true, message: `Generating emails for ${contacts.length} contacts` });
  } catch (err) {
    logger.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to trigger emails' });
  }
});

module.exports = router;
