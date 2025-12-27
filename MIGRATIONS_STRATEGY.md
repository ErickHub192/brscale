# Database Migrations Strategy for Century AI 21

## 🎯 3 Options for Database Migrations (TypeScript Native)

### **Option 1: Supabase CLI** (Recommended for Supabase) ⭐

**Pros:**
- ✅ Native to Supabase
- ✅ Simple SQL migrations
- ✅ Built-in local dev with Docker
- ✅ Auto-generates migration files
- ✅ Seed data support
- ✅ Version control friendly

**How it works:**
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase in project
supabase init

# Create migration
supabase migration new create_properties_table

# Write SQL in: supabase/migrations/20250122_create_properties_table.sql
# Apply migrations locally
supabase db reset

# Deploy to production
supabase db push
```

**File structure:**
```
project/
├── supabase/
│   ├── migrations/
│   │   ├── 20250122000000_create_properties_table.sql
│   │   ├── 20250122000001_create_leads_table.sql
│   │   └── 20250122000002_create_offers_table.sql
│   └── seed.sql  # Optional seed data
```

**Example migration:**
```sql
-- supabase/migrations/20250122000000_create_properties_table.sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  address JSONB NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **Option 2: Drizzle ORM** (TypeScript-first)

**Pros:**
- ✅ TypeScript schema as source of truth
- ✅ Type-safe queries
- ✅ Auto-generates migrations from schema changes
- ✅ Lightweight (no runtime overhead)
- ✅ Works with Supabase

**How it works:**
```bash
npm install drizzle-orm drizzle-kit
```

**Define schema in TypeScript:**
```typescript
// src/infrastructure/database/schema.ts
import { pgTable, uuid, text, decimal, timestamp } from 'drizzle-orm/pg-core';

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Generate and apply migrations:**
```bash
# Generate migration from schema
npx drizzle-kit generate

# Apply to database
npx drizzle-kit migrate
```

---

### **Option 3: Prisma** (Most popular ORM)

**Pros:**
- ✅ Most mature TypeScript ORM
- ✅ Great TypeScript support
- ✅ Auto-generates types
- ✅ Prisma Studio (GUI for data)
- ✅ Works with Supabase

**Cons:**
- ⚠️ Heavier than Drizzle
- ⚠️ Some Supabase features not supported (RLS policies)

**How it works:**
```bash
npm install prisma @prisma/client
npx prisma init
```

**Define schema:**
```prisma
// prisma/schema.prisma
model Property {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  title       String
  description String?
  price       Decimal  @db.Decimal(12, 2)
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("properties")
}
```

**Generate and apply:**
```bash
npx prisma migrate dev --name create_properties
npx prisma generate  # Generate TypeScript types
```

---

## 🎯 Recommendation for Century AI 21

### **Use: Supabase CLI + Drizzle ORM (Hybrid)** ⭐⭐⭐

**Why?**
1. **Supabase CLI** for migrations (simple, native, version controlled)
2. **Drizzle ORM** for TypeScript queries (type-safe, lightweight)
3. Best of both worlds: SQL control + TypeScript safety

### **Implementation:**

#### **1. Migrations with Supabase CLI**
```bash
# Create migration
supabase migration new create_properties_table

# Write SQL
# supabase/migrations/20250122_create_properties_table.sql
```

#### **2. Define Drizzle schema for type-safe queries**
```typescript
// src/infrastructure/database/schema.ts
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  // ... match your SQL schema
});
```

#### **3. Use Drizzle for queries**
```typescript
// src/infrastructure/database/supabase/SupabasePropertyRepository.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { properties } from '../schema';

const db = drizzle(supabaseClient);

// Type-safe queries
const allProperties = await db.select().from(properties);
const property = await db.insert(properties).values({
  title: 'Beautiful House',
  // TypeScript autocomplete!
});
```

---

## 📁 Recommended Project Structure

```
century-ai-21/
├── supabase/
│   ├── migrations/           # SQL migrations (Supabase CLI)
│   │   ├── 20250122000000_create_properties_table.sql
│   │   ├── 20250122000001_create_leads_table.sql
│   │   ├── 20250122000002_create_offers_table.sql
│   │   └── 20250122000003_create_documents_table.sql
│   ├── seed.sql             # Seed data for development
│   └── config.toml          # Supabase config
│
├── src/
│   └── infrastructure/
│       └── database/
│           ├── schema.ts    # Drizzle schema (mirrors SQL)
│           └── supabase/
│               ├── client.ts
│               └── SupabasePropertyRepository.ts
│
└── drizzle.config.ts        # Drizzle config
```

---

## 🚀 Setup Commands

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Initialize Supabase
supabase init

# 3. Install Drizzle
npm install drizzle-orm postgres
npm install -D drizzle-kit

# 4. Create first migration
supabase migration new init_schema

# 5. Apply migrations locally
supabase start  # Starts local Postgres
supabase db reset

# 6. Deploy to production
supabase link --project-ref your-project-ref
supabase db push
```

---

## ✅ Final Decision

**Use Supabase CLI for migrations** because:
- ✅ Native to our stack
- ✅ Simple SQL (full control)
- ✅ Works with LangGraph PostgresSaver
- ✅ Version controlled
- ✅ Easy to review in PRs

**Optionally add Drizzle** later if we want type-safe queries (not required for MVP).

---

## 📝 Migration Workflow

```bash
# Local development
1. supabase migration new feature_name
2. Write SQL in generated file
3. supabase db reset  # Apply locally
4. Test changes
5. Commit migration file to git

# Deploy to production
6. supabase db push  # Applies to remote
```

**LangGraph tables** will be created automatically by PostgresSaver, no migration needed!
