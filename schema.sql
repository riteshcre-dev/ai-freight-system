-- ============================================================
-- AI Freight Load Acquisition System — Supabase Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE deal_stage AS ENUM (
  'search_started',
  'shipper_discovered',
  'contact_discovered',
  'email_generated',
  'email_sent',
  'reply_received',
  'potential_shipment',
  'details_requested',
  'shipment_secured',
  'carrier_ready'
);

CREATE TYPE reply_classification AS ENUM (
  'not_interested',
  'general_inquiry',
  'potential_shipment',
  'shipment_opportunity',
  'unclassified'
);

CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'dashboard');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE email_status AS ENUM ('queued', 'sent', 'opened', 'replied', 'bounced', 'failed');

-- ============================================================
-- SEARCHES
-- ============================================================

CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_type TEXT NOT NULL,
  location_filter TEXT,
  company_size_filter TEXT,
  import_export_filter BOOLEAN,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  results_count INTEGER DEFAULT 0
);

-- ============================================================
-- COMPANIES (SHIPPERS)
-- ============================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  product_types TEXT[],
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  company_size TEXT,
  is_importer BOOLEAN DEFAULT FALSE,
  is_exporter BOOLEAN DEFAULT FALSE,
  source TEXT, -- 'google_places', 'apollo', 'manual'
  source_id TEXT, -- external ID from data source
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, website)
);

-- ============================================================
-- CONTACTS
-- ============================================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT, -- 'apollo', 'hunter', 'clearbit', 'manual'
  confidence_score NUMERIC(3,2),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

-- ============================================================
-- EMAIL CAMPAIGNS & SEQUENCES
-- ============================================================

CREATE TABLE email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  product_type TEXT,
  steps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE SET NULL,
  sequence_step INTEGER DEFAULT 1,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status email_status DEFAULT 'queued',
  provider_message_id TEXT, -- SendGrid message ID
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  is_followup BOOLEAN DEFAULT FALSE,
  parent_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPLIES & AI CLASSIFICATION
-- ============================================================

CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  raw_body TEXT NOT NULL,
  from_email TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  classification reply_classification DEFAULT 'unclassified',
  ai_confidence NUMERIC(3,2),
  ai_summary TEXT,
  ai_extracted_data JSONB DEFAULT '{}', -- pickup, delivery, commodity, weight, etc.
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHIPMENT OPPORTUNITIES
-- ============================================================

CREATE TABLE shipment_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reply_id UUID REFERENCES replies(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  stage deal_stage DEFAULT 'potential_shipment',
  -- Shipment details
  pickup_location TEXT,
  delivery_location TEXT,
  commodity TEXT,
  weight_lbs NUMERIC,
  equipment_type TEXT, -- 'flatbed', 'reefer', 'dry_van', 'step_deck'
  pickup_date DATE,
  delivery_date DATE,
  special_requirements TEXT,
  estimated_rate NUMERIC,
  -- Conversation
  conversation_history JSONB DEFAULT '[]',
  is_secured BOOLEAN DEFAULT FALSE,
  secured_at TIMESTAMPTZ,
  carrier_assigned TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEALS (PIPELINE)
-- ============================================================

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES shipment_opportunities(id) ON DELETE SET NULL,
  stage deal_stage DEFAULT 'search_started',
  stage_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  stage deal_stage,
  channel notification_channel NOT NULL,
  status notification_status DEFAULT 'pending',
  subject TEXT,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI AGENT CONVERSATIONS
-- ============================================================

CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES shipment_opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  current_collecting TEXT, -- which field currently being collected
  fields_collected JSONB DEFAULT '{}',
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================

CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config (key, value) VALUES
  ('followup_delay_days', '3'),
  ('max_followups', '2'),
  ('daily_email_limit', '1000'),
  ('ai_model', '"claude-sonnet-4-20250514"'),
  ('notification_email', '"user@example.com"'),
  ('notification_phone', '"+15555555555"');

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_companies_search ON companies(search_id);
CREATE INDEX idx_companies_product ON companies USING GIN(product_types);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_emails_contact ON emails(contact_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_sent_at ON emails(sent_at);
CREATE INDEX idx_replies_email ON replies(email_id);
CREATE INDEX idx_replies_classification ON replies(classification);
CREATE INDEX idx_opportunities_stage ON shipment_opportunities(stage);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_notifications_status ON notifications(status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_opportunities_updated BEFORE UPDATE ON shipment_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON agent_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW pipeline_summary AS
SELECT
  d.stage,
  COUNT(*) AS count,
  COUNT(DISTINCT d.company_id) AS companies
FROM deals d
GROUP BY d.stage;

CREATE VIEW active_opportunities AS
SELECT
  so.*,
  c.name AS company_name,
  co.first_name || ' ' || co.last_name AS contact_name,
  co.email AS contact_email
FROM shipment_opportunities so
JOIN companies c ON c.id = so.company_id
JOIN contacts co ON co.id = so.contact_id
WHERE so.is_secured = FALSE
ORDER BY so.created_at DESC;

CREATE VIEW email_stats AS
SELECT
  DATE(sent_at) AS send_date,
  COUNT(*) AS sent,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened,
  COUNT(*) FILTER (WHERE status = 'replied') AS replied,
  ROUND(COUNT(*) FILTER (WHERE status = 'opened')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS open_rate,
  ROUND(COUNT(*) FILTER (WHERE status = 'replied')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS reply_rate
FROM emails
WHERE sent_at IS NOT NULL
GROUP BY DATE(sent_at)
ORDER BY send_date DESC;
