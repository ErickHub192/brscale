# BR SCALE - Technical Implementation Plan

Complete technical architecture for an AI-powered real estate marketplace for brokers, focused on **execution** and automated process management.

See [VISION.md](./docs/VISION.md) for our core philosophy.

## User Review Required

> [!IMPORTANT]
> **Tech Stack Decisions Needed:**
> 1. **AI Framework**: LangGraph
> 2. **LLM Provider**: OpenAI GPT-5.1 is preferred
> 3. **TypeScript**: Confirmed for type safet
> 4. **Deployment**: Vercel (Next.js native)

> [!WARNING]
> **Breaking Changes:**
> - Clean Architecture requires strict separation of concerns (may be more complex initially)
> - Multi-agent systems can be expensive with GPT-4o ($5-15/1M tokens)
> - Real-time features may require WebSocket infrastructure

---

## Proposed Tech Stack

### **Frontend & Backend**
- **Framework**: Next.js 16.1 (App Router) with TypeScript
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: Zustand or React Context
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Supabase Realtime subscriptions

### **AI & Agent Orchestration**
- **Framework**: **LangGraph** (recommended over LangChain)
  - Better for complex multi-agent workflows
  - Built-in state management
  - Visual workflow debugging
  - More control over agent interactions
- **LLM**: OpenAI GPT-5.1 (can switch to Gemini 3.5 Flash later)

### **Database & Backend**
- **Primary DB**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (property images/videos)
- **Edge Functions**: Supabase Edge Functions (Deno runtime)

### **Additional Services**
- **Email**: Resend or SendGrid
- **SMS/WhatsApp**: Twilio
- **Image Processing**: Cloudinary or Vercel Blob
- **Analytics**: Vercel Analytics + PostHog
- **Monitoring**: Sentry

---

## Clean Architecture Structure

```
century-ai-21/
├── src/
│   ├── domain/                    # Enterprise Business Rules
│   │   ├── entities/
│   │   │   ├── Property.ts
│   │   │   ├── Lead.ts
│   │   │   ├── Offer.ts
│   │   │   ├── User.ts
│   │   │   └── Transaction.ts
│   │   ├── value-objects/
│   │   │   ├── Address.ts
│   │   │   ├── Price.ts
│   │   │   └── PropertyStatus.ts
│   │   └── repositories/          # Repository interfaces
│   │       ├── IPropertyRepository.ts
│   │       ├── ILeadRepository.ts
│   │       └── IOfferRepository.ts
│   │
│   ├── application/               # Application Business Rules
│   │   ├── use-cases/
│   │   │   ├── property/
│   │   │   │   ├── CreateProperty.ts
│   │   │   │   ├── PublishProperty.ts
│   │   │   │   └── UpdatePropertyStatus.ts
│   │   │   ├── lead/
│   │   │   │   ├── QualifyLead.ts
│   │   │   │   ├── ScheduleVisit.ts
│   │   │   │   └── SendFollowUp.ts
│   │   │   └── offer/
│   │   │       ├── ProcessOffer.ts
│   │   │       ├── GenerateCounterOffer.ts
│   │   │       └── AcceptOffer.ts
│   │   ├── services/
│   │   │   ├── AIAgentOrchestrator.ts
│   │   │   ├── NotificationService.ts
│   │   │   └── DocumentGenerationService.ts
│   │   └── dto/
│   │       ├── CreatePropertyDTO.ts
│   │       └── LeadDTO.ts
│   │
│   ├── infrastructure/            # Frameworks & Drivers
│   │   ├── database/
│   │   │   ├── supabase/
│   │   │   │   ├── SupabasePropertyRepository.ts
│   │   │   │   ├── SupabaseLeadRepository.ts
│   │   │   │   └── client.ts
│   │   │   └── migrations/
│   │   ├── ai/
│   │   │   ├── agents/
│   │   │   │   ├── InputManagerAgent.ts
│   │   │   │   ├── MarketingAgent.ts
│   │   │   │   ├── LeadManagerAgent.ts
│   │   │   │   ├── NegotiationAgent.ts
│   │   │   │   └── LegalAgent.ts
│   │   │   ├── workflows/
│   │   │   │   └── PropertySalesWorkflow.ts
│   │   │   └── tools/
│   │   │       ├── PropertyAnalysisTool.ts
│   │   │       ├── MarketResearchTool.ts
│   │   │       └── DocumentGenerationTool.ts
│   │   ├── external/
│   │   │   ├── twilio/
│   │   │   ├── cloudinary/
│   │   │   └── email/
│   │   └── config/
│   │       └── env.ts
│   │
│   └── presentation/              # Interface Adapters
│       ├── app/                   # Next.js App Router
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   │   ├── properties/
│       │   │   ├── leads/
│       │   │   └── offers/
│       │   ├── api/
│       │   │   ├── properties/
│       │   │   ├── agents/
│       │   │   └── webhooks/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                # shadcn components
│       │   ├── property/
│       │   ├── lead/
│       │   └── dashboard/
│       ├── hooks/
│       └── lib/
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Database Schema Design

### **Core Tables**

#### **properties**
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  address JSONB NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  square_feet INTEGER,
  property_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, under_offer, sold
  images TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',
  ai_enhanced_description TEXT,
  ai_suggested_price DECIMAL(12,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **leads**
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT, -- web, whatsapp, email
  qualification_score INTEGER, -- 0-100
  status TEXT NOT NULL DEFAULT 'new', -- new, qualified, contacted, scheduled, lost
  ai_notes JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **offers**
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties NOT NULL,
  lead_id UUID REFERENCES leads NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, countered, accepted, rejected
  ai_recommendation TEXT,
  counter_offer_amount DECIMAL(12,2),
  terms JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **LangGraph Checkpoint Tables** (Auto-created by PostgresSaver)

> [!NOTE]
> LangGraph automatically creates and manages these tables when using `PostgresSaver`.
> We don't need to create them manually - just initialize the checkpointer.

```typescript
// LangGraph creates these tables automatically:
// - checkpoints: stores workflow state snapshots
// - checkpoint_blobs: stores large binary data
// - checkpoint_writes: stores pending writes

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  process.env.SUPABASE_CONNECTION_STRING
);
```

**To query agent execution history:**
```sql
-- Query LangGraph's checkpoints table
SELECT 
  thread_id,        -- maps to property_id
  checkpoint_id,
  metadata,
  created_at
FROM checkpoints
WHERE thread_id = 'property-uuid'
ORDER BY created_at DESC;
```

#### **documents**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties NOT NULL,
  offer_id UUID REFERENCES offers,
  document_type TEXT NOT NULL, -- contract, inspection, title, etc.
  file_url TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft', -- draft, pending_review, signed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Multi-Agent AI Workflow (LangGraph)

### **Workflow Architecture**

```typescript
// infrastructure/ai/workflows/PropertySalesWorkflow.ts

import { StateGraph, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

interface PropertySalesState {
  propertyId: string;
  propertyData: any;
  leads: any[];
  currentOffer?: any;
  stage: 'input' | 'marketing' | 'lead_management' | 'negotiation' | 'legal' | 'closure';
  humanInterventionRequired: boolean;
  agentOutputs: Record<string, any>;
}

// Initialize PostgresSaver for workflow persistence
const checkpointer = PostgresSaver.fromConnString(
  process.env.SUPABASE_CONNECTION_STRING!
);

const workflow = new StateGraph<PropertySalesState>({
  channels: {
    propertyId: null,
    propertyData: null,
    leads: null,
    currentOffer: null,
    stage: null,
    humanInterventionRequired: null,
    agentOutputs: null,
  }
});

// Define agents as nodes
workflow.addNode("input_manager", inputManagerAgent);
workflow.addNode("marketing", marketingAgent);
workflow.addNode("lead_manager", leadManagerAgent);
workflow.addNode("negotiation", negotiationAgent);
workflow.addNode("legal", legalAgent);
workflow.addNode("human_review", humanReviewNode);

// Define edges (workflow transitions)
workflow.addEdge("input_manager", "marketing");
workflow.addEdge("marketing", "lead_manager");
workflow.addConditionalEdges(
  "lead_manager",
  (state) => state.leads.length > 0 ? "negotiation" : "marketing"
);
workflow.addConditionalEdges(
  "negotiation",
  (state) => state.humanInterventionRequired ? "human_review" : "legal"
);
workflow.addEdge("legal", END);

workflow.setEntryPoint("input_manager");

// Compile with checkpointer for persistence
const graph = workflow.compile({ checkpointer });

// Execute workflow with thread_id (each property gets its own thread)
export async function executePropertyWorkflow(propertyId: string, propertyData: any) {
  const config = {
    configurable: {
      thread_id: propertyId, // Isolates state per property
    }
  };
  
  const result = await graph.invoke({
    propertyId,
    propertyData,
    leads: [],
    stage: 'input',
    humanInterventionRequired: false,
    agentOutputs: {},
  }, config);
  
  return result;
}
```

### **Execution Strategy: Hybrid (Sequential + Parallel)**

> [!NOTE]
> **Workflow between agents: SEQUENTIAL** (one after another)  
> **Tasks within each agent: PARALLEL** (simultaneous execution)

**Why this approach:**
- ✅ Agents depend on each other's outputs (must be sequential)
- ✅ Tasks within an agent are independent (can be parallel)
- ✅ Balances reliability with performance

**Performance:**
```typescript
// Sequential between agents (required for dependencies)
Input Manager (10s)
    ↓
Marketing Agent (15s) ← Parallelizes internally
    ↓
Lead Manager (10s) ← Parallelizes internally
    ↓
Total: ~35s (vs ~60s if everything was sequential)
```

**Example of parallel execution within agents:**
```typescript
// Marketing Agent runs multiple tasks simultaneously
async function marketingAgent(state: PropertySalesState) {
  // These run in PARALLEL (saves ~20 seconds)
  const [social, listings, images] = await Promise.all([
    generateSocialMediaPosts(state.propertyData),
    generateListingDescriptions(state.propertyData),
    optimizePropertyImages(state.propertyData)
  ]);
  
  return { marketingContent: { social, listings, images } };
}
```

---

### **Agent Implementations**


#### **1. Input Manager Agent**
```typescript
// infrastructure/ai/agents/InputManagerAgent.ts

import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";

export class InputManagerAgent {
  private llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.3,
    });
  }

  async execute(propertyData: any) {
    const prompt = `
      Analyze this property data and:
      1. Validate completeness (all required fields)
      2. Enhance the description for marketing
      3. Suggest optimal pricing based on market data
      4. Generate SEO-friendly title
      
      Property Data: ${JSON.stringify(propertyData)}
    `;

    const response = await this.llm.invoke(prompt);
    
    return {
      validated: true,
      enhancedDescription: response.content,
      suggestedPrice: 0, // Extract from response
      seoTitle: "", // Extract from response
    };
  }
}
```

#### **2. Marketing Agent**
```typescript
// infrastructure/ai/agents/MarketingAgent.ts

export class MarketingAgent {
  async execute(propertyData: any) {
    // PARALLEL EXECUTION: Generate all marketing content simultaneously
    const [socialPosts, listings, images, seo] = await Promise.all([
      this.generateSocialMedia(propertyData),
      this.generateListings(propertyData),
      this.optimizeImages(propertyData.images),
      this.generateSEO(propertyData)
    ]);
    
    return {
      marketingContent: {
        socialMediaPosts: socialPosts,
        listingDescriptions: listings,
        optimizedImages: images,
        seoContent: seo
      }
    };
  }
  
  private async generateSocialMedia(data: any) {
    // Generate Instagram, Facebook, TikTok posts
    return [];
  }
  
  private async generateListings(data: any) {
    // Generate descriptions for Zillow, Realtor.com, etc.
    return {};
  }
  
  private async optimizeImages(images: string[]) {
    // AI image enhancement
    return images;
  }
  
  private async generateSEO(data: any) {
    // SEO-optimized content
    return { title: '', description: '', tags: [] };
  }
}
```

#### **3. Lead Manager Agent**
```typescript
// infrastructure/ai/agents/LeadManagerAgent.ts

export class LeadManagerAgent {
  async execute(leads: any[]) {
    // PARALLEL EXECUTION: Qualify all leads simultaneously
    const qualifiedLeads = await Promise.all(
      leads.map(lead => this.qualifyLead(lead))
    );
    
    // Filter only qualified leads (score > 60)
    const highQualityLeads = qualifiedLeads.filter(l => l.score > 60);
    
    return {
      qualifiedLeads: highQualityLeads,
      scheduledVisits: [],
      sentMessages: []
    };
  }
  
  private async qualifyLead(lead: any) {
    // Qualify individual lead (budget, timeline, seriousness)
    const score = await this.calculateQualificationScore(lead);
    return { ...lead, score };
  }
  
  private async calculateQualificationScore(lead: any) {
    // LLM call to score lead 0-100
    return 75;
  }
}
```

---

## API Routes Structure

### **Property Management**
- `POST /api/properties` - Create property
- `GET /api/properties/:id` - Get property details
- `PATCH /api/properties/:id` - Update property
- `POST /api/properties/:id/publish` - Trigger marketing agent

### **Agent Execution**
- `POST /api/agents/execute` - Manually trigger agent
- `GET /api/agents/status/:executionId` - Check agent status
- `POST /api/agents/workflow/start` - Start full workflow

### **Leads**
- `GET /api/leads` - List all leads
- `POST /api/leads/:id/qualify` - Trigger lead qualification
- `POST /api/leads/:id/message` - Send message to lead

### **Webhooks**
- `POST /api/webhooks/twilio` - WhatsApp messages
- `POST /api/webhooks/supabase` - Database changes

---

## Cost Estimation (MVP)

### **Development**
- Next.js + Supabase: Free tier (sufficient for MVP)
- OpenAI GPT-4o: ~$100-300/month (testing)
- Twilio: ~$50/month (WhatsApp sandbox)
- **Total**: ~$150-350/month

### **Production (Phase 2)**
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- OpenAI: $500-1000/month (100 properties)
- Twilio: $200/month
- **Total**: ~$745-1245/month

---

## Timeline Estimate

- **Week 1-2**: Project setup + Clean Architecture structure
- **Week 3-4**: Database schema + Supabase integration
- **Week 5-6**: First 3 agents (Input, Marketing, Lead Manager)
- **Week 7-8**: Remaining agents + workflow integration
- **Week 9-10**: Frontend dashboard + API routes
- **Week 11-12**: Testing + Phase 1 pilot

**Total**: ~3 months to MVP
