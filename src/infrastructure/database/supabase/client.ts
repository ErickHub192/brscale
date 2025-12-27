// Supabase Client Configuration
// Singleton pattern to avoid multiple instances

import { createClient } from '@supabase/supabase-js';
import { env } from '@/infrastructure/config/env';

// Create Supabase client
export const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    }
);

// Server-side client with service role (for admin operations)
export const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

// Database types (will be auto-generated later with `supabase gen types typescript`)
export type Database = {
    public: {
        Tables: {
            properties: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    description: string | null;
                    address: Record<string, unknown>;
                    price: number;
                    bedrooms: number | null;
                    bathrooms: number | null;
                    square_feet: number | null;
                    property_type: 'house' | 'apartment' | 'condo' | 'townhouse' | 'land' | 'commercial';
                    status: 'draft' | 'active' | 'under_offer' | 'sold' | 'withdrawn';
                    images: string[];
                    videos: string[];
                    ai_enhanced_description: string | null;
                    ai_suggested_price: number | null;
                    metadata: Record<string, unknown>;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['properties']['Insert']>;
            };
        };
    };
};
