-- Create properties table
-- This is the main table for storing property listings

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  
  -- Address (stored as JSONB for flexibility)
  address JSONB NOT NULL,
  
  -- Property details
  price DECIMAL(12,2) NOT NULL CHECK (price > 0),
  bedrooms INTEGER CHECK (bedrooms >= 0),
  bathrooms DECIMAL(3,1) CHECK (bathrooms >= 0),
  square_feet INTEGER CHECK (square_feet > 0),
  property_type TEXT NOT NULL CHECK (property_type IN ('house', 'apartment', 'condo', 'townhouse', 'land', 'commercial')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'under_offer', 'sold', 'withdrawn')),
  
  -- Media
  images TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',
  
  -- AI-enhanced fields
  ai_enhanced_description TEXT,
  ai_suggested_price DECIMAL(12,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_property_type ON properties(property_type);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own properties
CREATE POLICY "Users can view own properties"
  ON properties FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own properties
CREATE POLICY "Users can insert own properties"
  ON properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own properties
CREATE POLICY "Users can update own properties"
  ON properties FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own properties
CREATE POLICY "Users can delete own properties"
  ON properties FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view active properties (for marketplace)
CREATE POLICY "Public can view active properties"
  ON properties FOR SELECT
  USING (status = 'active');
