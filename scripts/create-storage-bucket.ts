/**
 * Create Supabase Storage Bucket for Legal Documents
 * Run with: npx tsx scripts/create-storage-bucket.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local file manually
const envPath = join(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const envVars: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    let value = valueParts.join('=').trim();
    // Remove comments
    const commentIndex = value.indexOf('#');
    if (commentIndex !== -1) {
      value = value.substring(0, commentIndex).trim();
    }
    envVars[key.trim()] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SECRET_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('URL:', supabaseUrl);
  console.error('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createStorageBucket() {
  console.log('🚀 Creating legal-documents storage bucket...\n');

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets?.some((b) => b.id === 'legal-documents');

    if (bucketExists) {
      console.log('✅ Bucket "legal-documents" already exists\n');
      return;
    }

    // Create bucket
    const { data: bucket, error: createError } = await supabase.storage.createBucket(
      'legal-documents',
      {
        public: false, // Private bucket
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf'],
      }
    );

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }

    console.log('✅ Bucket "legal-documents" created successfully!\n');
    console.log('Bucket details:', bucket);

    // Note: Storage policies need to be created via SQL
    console.log('\n⚠️  NOTE: You still need to create storage policies via SQL:');
    console.log('Run the migration: supabase/migrations/20251223_create_storage_buckets.sql\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createStorageBucket();
