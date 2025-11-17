-- Budget Health Management Database Schema

-- Users table (app accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  legacy_member_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_legacy_member_id ON users(legacy_member_id);

-- User sessions table (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- User profiles (additional info not in legacy)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  date_of_birth DATE,
  id_number VARCHAR(50),
  member_number VARCHAR(50),
  profile_image_url TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_id_number ON user_profiles(id_number);
CREATE INDEX idx_user_profiles_member_number ON user_profiles(member_number);

-- Members table (synced from legacy system)
-- This is a local copy of membership data for fast lookups during registration
-- Updated periodically via sync job
CREATE TABLE IF NOT EXISTS members (
  id BIGSERIAL PRIMARY KEY,
  legacy_member_id BIGINT UNIQUE NOT NULL,
  segregated_fund TEXT,
  title TEXT,
  member_no TEXT,
  suffix TEXT,
  firstname TEXT,
  initials TEXT,
  surname TEXT,
  sex TEXT,
  nationality TEXT,
  occupation TEXT,
  member_status TEXT,
  date_of_birth DATE,
  date_of_joining DATE,
  date_of_resigning DATE,
  national_id_no TEXT,
  plan TEXT,
  is_dependant BOOLEAN DEFAULT false,
  cellphone_no TEXT,
  email_address TEXT,
  email_address2 TEXT,
  company TEXT,
  notes TEXT,
  parent_legacy_id BIGINT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_members_national_id ON members (national_id_no) WHERE is_dependant = false;
CREATE INDEX idx_members_member_no ON members (member_no) WHERE is_dependant = false;
CREATE INDEX idx_members_legacy_member_id ON members (legacy_member_id);
CREATE INDEX idx_members_parent_legacy_id ON members (parent_legacy_id) WHERE is_dependant = true;
CREATE INDEX idx_members_status ON members (member_status);
CREATE INDEX idx_members_company ON members (company);

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Claims cache (local copy for performance)
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legacy_claim_id VARCHAR(100),
  claim_number VARCHAR(100) UNIQUE,
  claim_type VARCHAR(50),
  provider_name VARCHAR(255),
  claim_date DATE,
  amount DECIMAL(10, 2),
  status VARCHAR(50),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claims_user_id ON claims(user_id);
CREATE INDEX idx_claims_claim_number ON claims(claim_number);
CREATE INDEX idx_claims_legacy_claim_id ON claims(legacy_claim_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_claim_date ON claims(claim_date DESC);

-- Claim documents
CREATE TABLE IF NOT EXISTS claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  document_type VARCHAR(50),
  file_name VARCHAR(255),
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claim_documents_claim_id ON claim_documents(claim_id);

-- Provider search cache
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_provider_id VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  specialties TEXT[],
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(20),
  phone_number VARCHAR(20),
  email VARCHAR(255),
  location GEOGRAPHY(POINT, 4326), -- For geospatial queries
  network_status VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_providers_legacy_id ON providers(legacy_provider_id);
CREATE INDEX idx_providers_name ON providers USING gin(to_tsvector('english', name));
CREATE INDEX idx_providers_city ON providers(city);
CREATE INDEX idx_providers_province ON providers(province);
CREATE INDEX idx_providers_type ON providers(type);
CREATE INDEX idx_providers_location ON providers USING GIST(location);

-- Physical card requests
CREATE TABLE IF NOT EXISTS card_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('NEW', 'REPLACEMENT', 'RENEWAL')),
  reason TEXT,
  delivery_address TEXT NOT NULL,
  delivery_city VARCHAR(100),
  delivery_province VARCHAR(100),
  delivery_postal_code VARCHAR(20),
  contact_phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED')),
  tracking_number VARCHAR(100),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  rejected_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_card_requests_user_id ON card_requests(user_id);
CREATE INDEX idx_card_requests_status ON card_requests(status);
CREATE INDEX idx_card_requests_requested_at ON card_requests(requested_at DESC);

-- Support queries
CREATE TABLE IF NOT EXISTS support_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(100) CHECK (category IN ('BILLING', 'CLAIMS', 'COVERAGE', 'TECHNICAL', 'ACCOUNT', 'GENERAL', 'COMPLAINT')),
  priority VARCHAR(50) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED')),
  assigned_to VARCHAR(100),
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE INDEX idx_support_queries_user_id ON support_queries(user_id);
CREATE INDEX idx_support_queries_status ON support_queries(status);
CREATE INDEX idx_support_queries_category ON support_queries(category);
CREATE INDEX idx_support_queries_created_at ON support_queries(created_at DESC);

-- Support query messages (for conversation thread)
CREATE TABLE IF NOT EXISTS support_query_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES support_queries(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('USER', 'SUPPORT')),
  sender_name VARCHAR(255),
  message TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_query_messages_query_id ON support_query_messages(query_id);
CREATE INDEX idx_support_query_messages_created_at ON support_query_messages(created_at);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_requests_updated_at BEFORE UPDATE ON card_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_queries_updated_at BEFORE UPDATE ON support_queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
