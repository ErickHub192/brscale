-- ============================================================================
-- BR SCALE - Database Schema
-- AI-Powered Real Estate Automation Platform
-- ============================================================================
-- Version: 1.0.0
-- Last Updated: 2025-12-23
-- Description: Complete database schema including tables, policies, functions,
--              and storage buckets for the BR SCALE platform
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostgreSQL full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table
-- Links to Supabase Auth and stores additional profile data
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'seller' CHECK (role IN ('seller', 'buyer', 'admin', 'broker')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ----------------------------------------------------------------------------
-- Properties Table
-- Main table for property listings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Basic Info
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Address (JSONB for flexibility)
  address JSONB NOT NULL,

  -- Property Details
  price NUMERIC(12, 2) NOT NULL,
  bedrooms INTEGER NOT NULL,
  bathrooms NUMERIC(3, 1),
  square_feet INTEGER,
  property_type TEXT NOT NULL CHECK (property_type IN ('house', 'apartment', 'condo', 'townhouse', 'land')),

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'pending', 'sold', 'archived')),

  -- Media
  images TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',

  -- AI Generated Content
  ai_enhanced_description TEXT,
  ai_suggested_price NUMERIC(12, 2),

  -- Additional Data
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON public.properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_address_gin ON public.properties USING GIN (address);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_properties_title_trgm ON public.properties USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_description_trgm ON public.properties USING GIN (description gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- LangGraph Checkpoints Table
-- Stores workflow state for LangGraph execution
-- Used by @langchain/langgraph-checkpoint-postgres
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_id)
);

-- Index for checkpoint lookups
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id ON public.checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at ON public.checkpoints(created_at DESC);

-- ----------------------------------------------------------------------------
-- Leads Table
-- Stores potential buyer leads for properties
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Lead Info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,

  -- Lead Qualification
  qualified BOOLEAN DEFAULT false,
  qualification_score INTEGER CHECK (qualification_score >= 0 AND qualification_score <= 100),
  qualification_notes TEXT,

  -- Lead Source
  source TEXT CHECK (source IN ('website', 'zillow', 'realtor', 'social_media', 'referral', 'other')),

  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'scheduled', 'lost', 'converted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON public.leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_qualified ON public.leads(qualified);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);

-- ----------------------------------------------------------------------------
-- Offers Table
-- Stores purchase offers for properties
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Offer Details
  amount NUMERIC(12, 2) NOT NULL,
  conditions TEXT[] DEFAULT '{}',
  contingencies TEXT[] DEFAULT '{}',
  closing_date DATE,

  -- Buyer Info
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,

  -- Financing
  financing_type TEXT CHECK (financing_type IN ('cash', 'conventional', 'fha', 'va', 'other')),
  pre_approved BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired')),

  -- Counter Offer
  counter_offer_amount NUMERIC(12, 2),
  counter_offer_notes TEXT,

  -- AI Analysis
  ai_recommendation TEXT,
  ai_analysis JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offers_property_id ON public.offers(property_id);
CREATE INDEX IF NOT EXISTS idx_offers_lead_id ON public.offers(lead_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON public.offers(created_at DESC);

-- ----------------------------------------------------------------------------
-- Legal Documents Table
-- Tracks legal documents generated for properties
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,

  -- Document Info
  document_type TEXT NOT NULL CHECK (document_type IN (
    'purchase_contract',
    'disclosure',
    'inspection_checklist',
    'closing_checklist',
    'addendum',
    'other'
  )),
  title TEXT NOT NULL,

  -- Storage
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  signed_url TEXT, -- Temporary signed URL
  file_size INTEGER, -- Size in bytes

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'signed', 'archived')),

  -- Signing
  requires_signature BOOLEAN DEFAULT true,
  signed_by UUID REFERENCES public.users(id),
  signed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_legal_documents_property_id ON public.legal_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_offer_id ON public.legal_documents(offer_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON public.legal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_status ON public.legal_documents(status);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Auto-create user profile on auth signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Users Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role has full access to users"
  ON public.users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Properties Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can view active properties"
  ON public.properties FOR SELECT
  TO public
  USING (status = 'active');

CREATE POLICY "Users can view own properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own properties"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own properties"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own properties"
  ON public.properties FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to properties"
  ON public.properties FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Leads Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can create leads"
  ON public.leads FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Property owners can view leads for their properties"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Property owners can update leads for their properties"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to leads"
  ON public.leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Offers Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can create offers"
  ON public.offers FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Property owners can view offers for their properties"
  ON public.offers FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Property owners can update offers for their properties"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to offers"
  ON public.offers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Legal Documents Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Property owners can view legal docs for their properties"
  ON public.legal_documents FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to legal documents"
  ON public.legal_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STORAGE BUCKETS & POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Legal Documents Bucket
-- Stores generated PDFs (contracts, disclosures, checklists)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-documents',
  'legal-documents',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for legal-documents bucket
CREATE POLICY "Service role has full access to legal documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'legal-documents')
  WITH CHECK (bucket_id = 'legal-documents');

CREATE POLICY "Authenticated users can view their own legal documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can upload their own legal documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Property Images Bucket
-- Stores property photos and media
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true, -- Public bucket
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for property-images bucket
CREATE POLICY "Anyone can view property images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can upload property images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "Users can update their own property images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'property-images');

CREATE POLICY "Users can delete their own property images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'property-images');

-- ============================================================================
-- VIEWS (Optional - for common queries)
-- ============================================================================

-- Active properties with owner info
CREATE OR REPLACE VIEW public.active_properties_with_owner AS
SELECT
  p.*,
  u.full_name as owner_name,
  u.email as owner_email,
  u.phone as owner_phone
FROM public.properties p
JOIN public.users u ON p.user_id = u.id
WHERE p.status = 'active';

-- Property offer summary
CREATE OR REPLACE VIEW public.property_offer_summary AS
SELECT
  p.id as property_id,
  p.title,
  p.price as asking_price,
  COUNT(o.id) as total_offers,
  COUNT(o.id) FILTER (WHERE o.status = 'pending') as pending_offers,
  MAX(o.amount) as highest_offer,
  MIN(o.amount) as lowest_offer,
  AVG(o.amount) as average_offer
FROM public.properties p
LEFT JOIN public.offers o ON p.id = o.property_id
GROUP BY p.id, p.title, p.price;

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.users IS 'User profiles linked to Supabase Auth';
COMMENT ON TABLE public.properties IS 'Main property listings table';
COMMENT ON TABLE public.leads IS 'Potential buyer leads for properties';
COMMENT ON TABLE public.offers IS 'Purchase offers on properties';
COMMENT ON TABLE public.legal_documents IS 'Generated legal documents (contracts, disclosures)';
COMMENT ON TABLE public.checkpoints IS 'LangGraph workflow checkpoints for AI agent execution';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- To apply this schema:
-- 1. Run in Supabase SQL Editor
-- 2. Or use: psql -h <host> -U postgres -d postgres -f schema.sql
-- ============================================================================
