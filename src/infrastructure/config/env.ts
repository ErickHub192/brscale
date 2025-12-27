// Infrastructure Layer - Configuration
// Centralized configuration to avoid hardcoded values

import { z } from 'zod';

const envSchema = z.object({
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SUPABASE_CONNECTION_STRING: z.string().min(1),

    // OpenAI
    OPENAI_API_KEY: z.string().startsWith('sk-'),

    // Twilio
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_NUMBER: z.string().optional(),

    // App
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
});

function getEnv() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
        throw new Error('Invalid environment variables');
    }

    return parsed.data;
}

export const env = getEnv();

// Agent Configuration - Avoid hardcoded model names
export const AI_CONFIG = {
    models: {
        primary: 'gpt-4o' as const,
        fallback: 'gpt-3.5-turbo' as const,
    },
    temperature: {
        creative: 0.7,
        precise: 0.3,
        deterministic: 0.0,
    },
    maxTokens: {
        short: 500,
        medium: 1500,
        long: 4000,
    },
} as const;

// Agent Types - Avoid hardcoded strings
export const AGENT_TYPES = {
    INPUT_MANAGER: 'input_manager',
    MARKETING: 'marketing',
    LEAD_MANAGER: 'lead_manager',
    NEGOTIATION: 'negotiation',
    LEGAL: 'legal',
} as const;

export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];
