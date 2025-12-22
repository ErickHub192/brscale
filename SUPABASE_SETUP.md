# Supabase Setup Instructions

## 🔐 Get Your API Keys

1. **Login to Supabase**: https://supabase.com/dashboard/project/unfancvnqibtbmzhcuzi

2. **Navigate to Settings → API**: https://supabase.com/dashboard/project/unfancvnqibtbmzhcuzi/settings/api

3. **Copy the following values:**
   - **Project URL**: `https://unfancvnqibtbmzhcuzi.supabase.co`
   - **publishable key** (previously called "anon public key"): (starts with `eyJ...`)
   - **secret key** (previously called "service_role key"): (starts with `eyJ...`) ⚠️ Keep this secret!

## 📝 Create .env.local File

Create a file called `.env.local` in the root directory with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://unfancvnqibtbmzhcuzi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<paste-your-publishable-key-here>
SUPABASE_SECRET_KEY=<paste-your-secret-key-here>
SUPABASE_CONNECTION_STRING=postgresql://postgres:donscanor192@db.unfancvnqibtbmzhcuzi.supabase.co:5432/postgres

# OpenAI (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-key-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## 🚀 Apply Database Migration

Once you have `.env.local` configured, run:

```bash
# Link to your Supabase project
npx supabase link --project-ref unfancvnqibtbmzhcuzi

# Apply the migration
npx supabase db push
```

This will create the `properties` table with:
- ✅ RLS policies
- ✅ Indexes
- ✅ Triggers for `updated_at`

## ✅ Verify Setup

After migration, you should see the `properties` table in:
https://supabase.com/dashboard/project/unfancvnqibtbmzhcuzi/editor

## 🔄 Next Steps

Once Supabase is connected:
1. ✅ Test the connection
2. ✅ Setup LangGraph
3. ✅ Configure OpenAI GPT-5.1
4. ✅ Create first API route

---

**Need help?** Let me know when you've added the API keys to `.env.local` and I'll help apply the migration.
