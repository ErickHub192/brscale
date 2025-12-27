# BR SCALE Database Schema & Migrations

This directory contains all database schemas, migrations, and documentation for the BR SCALE platform.

## 📁 Directory Structure

```
supabase/
├── schema.sql                          # Complete database schema (reference)
├── migrations/                         # Migration files (applied in order)
│   ├── 20251222182014_create_properties_table.sql
│   └── 20251223_create_storage_buckets.sql
└── README.md                          # This file
```

## 🗄️ Database Overview

### **Core Tables:**

1. **users** - User profiles (linked to Supabase Auth)
2. **properties** - Property listings
3. **leads** - Potential buyer leads
4. **offers** - Purchase offers on properties
5. **legal_documents** - Generated contracts, disclosures, checklists
6. **checkpoints** - LangGraph workflow state (for AI agents)

### **Storage Buckets:**

1. **legal-documents** (private) - PDF contracts, disclosures, checklists
2. **property-images** (public) - Property photos and media

## 🚀 Quick Start

### **Option 1: Apply Complete Schema (Fresh Database)**

If you're starting fresh, run the complete schema:

```bash
# In Supabase SQL Editor, paste the contents of:
supabase/schema.sql
```

### **Option 2: Run Migrations (Incremental Updates)**

If you have an existing database, run migrations in order:

```bash
# Migration 1: Properties table
supabase/migrations/20251222182014_create_properties_table.sql

# Migration 2: Storage buckets
supabase/migrations/20251223_create_storage_buckets.sql
```

## 📝 Creating New Migrations

When you make schema changes:

1. **Create a new migration file:**
   ```bash
   touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql
   ```

2. **Write your migration:**
   ```sql
   -- Add your schema changes here
   ALTER TABLE properties ADD COLUMN year_built INTEGER;
   ```

3. **Update schema.sql:**
   - Keep `schema.sql` as the source of truth
   - Update it with your changes
   - This file should always represent the current state

4. **Test the migration:**
   - Run it in Supabase SQL Editor
   - Verify no errors
   - Check data integrity

## 🔒 Row Level Security (RLS)

All tables have RLS enabled with policies:

### **Properties:**
- ✅ Public can view `active` properties
- ✅ Users can CRUD their own properties
- ✅ Service role has full access

### **Leads:**
- ✅ Anyone can create leads (public form submissions)
- ✅ Property owners can view/update leads for their properties
- ✅ Service role has full access

### **Offers:**
- ✅ Anyone can create offers
- ✅ Property owners can view/update offers for their properties
- ✅ Service role has full access

### **Legal Documents:**
- ✅ Property owners can view docs for their properties
- ✅ Service role has full access (AI generates docs)

## 🛠️ Useful Queries

### **Check RLS Policies:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

### **List All Tables:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### **View Table Sizes:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### **Check Indexes:**
```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 🔄 Syncing with Production

### **Export Current Schema:**
```bash
# From your Supabase project
pg_dump -h db.yourproject.supabase.co -U postgres -d postgres --schema-only > schema_backup.sql
```

### **Compare Schemas:**
```bash
# Use a diff tool to compare
diff supabase/schema.sql schema_backup.sql
```

## 📊 Database Diagram

```
┌─────────────┐
│   auth.users│
└──────┬──────┘
       │
       │ (1:1)
       ▼
┌─────────────┐      ┌──────────────┐
│ public.users│──────│ properties   │
└─────────────┘      └──────┬───────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
          ┌─────────┐ ┌─────────┐ ┌──────────────┐
          │  leads  │ │  offers │ │legal_documents│
          └─────────┘ └─────────┘ └──────────────┘

                     ┌──────────────┐
                     │ checkpoints  │ (LangGraph state)
                     └──────────────┘
```

## 🔐 Environment Variables

Make sure these are set in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key
SUPABASE_CONNECTION_STRING=your_connection_string
```

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Docs](https://supabase.com/docs/guides/storage)

## 🐛 Troubleshooting

### **RLS Policy Errors:**
```sql
-- Check which role is accessing
SELECT current_user, current_setting('request.jwt.claims', true);

-- Temporarily disable RLS for debugging (DO NOT USE IN PRODUCTION)
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
```

### **Migration Failed:**
```sql
-- Rollback last migration
-- (Manually undo changes or restore from backup)

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

### **Storage Bucket Issues:**
```sql
-- List all buckets
SELECT * FROM storage.buckets;

-- List bucket policies
SELECT * FROM storage.policies WHERE bucket_id = 'legal-documents';
```

---

**Last Updated:** 2025-12-23
**Database Version:** PostgreSQL 15 (Supabase)
**Schema Version:** 1.0.0
