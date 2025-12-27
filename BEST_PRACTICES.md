# Multi-Agent System Best Practices (2025)

**Sources:** Anthropic Research, LangGraph Documentation, Model Context Protocol

---

## 🎯 Core Principles from Anthropic

### **1. Start Simple, Add Complexity Only When Needed**

> "We recommend finding the simplest solution possible, and only increasing complexity when needed."

**For Century AI 21:**
- ✅ Start with 3 agents (Input, Marketing, Lead Manager)
- ✅ Add Negotiation + Legal only after core works
- ❌ Don't build all 6 agents at once

### **2. Workflows vs Agents**

**Workflows** (Recommended for us):
- Predefined code paths
- LLMs + tools orchestrated through fixed logic
- More predictable and consistent
- **Use when:** Task is well-defined (like property sales process)

**Agents** (More complex):
- LLMs dynamically direct their own processes
- More flexible but less predictable
- **Use when:** Task requires dynamic decision-making

**Our approach:** **Workflow-based** (LangGraph StateGraph with fixed nodes)

---

## 📋 Proven Workflow Patterns

### **Pattern 1: Prompt Chaining** ⭐ (Use this)

**What:** Break task into sequential steps, each LLM call processes previous output

**When to use:** Task can be decomposed into fixed subtasks

**Example for us:**
```
Property Input → Validate Data → Enhance Description → Suggest Price
```

**Implementation:**
```typescript
// Each agent is a step in the chain
workflow.addEdge("input_manager", "marketing");
workflow.addEdge("marketing", "lead_manager");
```

**Benefits:**
- Higher accuracy (each step is simpler)
- Easy to debug (inspect each step)
- Predictable flow

---

### **Pattern 2: Orchestrator-Workers** ⭐ (Consider for complex tasks)

**What:** Central LLM breaks down tasks and delegates to worker LLMs

**When to use:** Complex tasks where subtasks aren't predictable

**Example for us:**
```
Marketing Agent (orchestrator)
  ├─ Social Media Worker
  ├─ Listing Description Worker
  └─ Image Optimization Worker
```

**Benefits:**
- Handles complex, unpredictable tasks
- Workers can be specialized
- Scalable

---

### **Pattern 3: Parallelization** (Optional optimization)

**What:** Run multiple LLM calls simultaneously and aggregate results

**Two variations:**
1. **Sectioning:** Different subtasks in parallel
2. **Voting:** Same task multiple times for consensus

**Example for us:**
```typescript
// Run lead qualification from multiple angles in parallel
const [budgetScore, timelineScore, seriousnessScore] = await Promise.all([
  qualifyBudget(lead),
  qualifyTimeline(lead),
  qualifySeriousness(lead)
]);
```

**When to use:** Speed is critical, or need high confidence

---

### **Pattern 4: Routing** (Use for efficiency)

**What:** Classify input and route to specialized handler

**Example for us:**
```typescript
// Route leads to appropriate handler
if (lead.source === 'whatsapp') {
  return handleWhatsAppLead(lead);
} else if (lead.source === 'email') {
  return handleEmailLead(lead);
}

// Or route by complexity
if (isSimpleQuery(lead)) {
  return useHaikuModel(lead); // Cheaper model
} else {
  return useSonnetModel(lead); // More capable
}
```

**Benefits:**
- Cost optimization (use cheaper models when possible)
- Better performance (specialized prompts)

---

## 🔧 Model Context Protocol (MCP) - 2025 Standard

### **What is MCP?**

Open standard by Anthropic for connecting AI to data sources and tools.

**Key benefits:**
- ✅ Standardized way to give LLMs access to tools
- ✅ Growing ecosystem of pre-built connectors
- ✅ Better than custom tool implementations

### **MCP for Century AI 21:**

Instead of building custom integrations, use MCP servers:

```typescript
// Example: MCP server for property data
import { MCPServer } from '@modelcontextprotocol/sdk';

const propertyServer = new MCPServer({
  name: 'property-data',
  tools: [
    {
      name: 'get_market_comparables',
      description: 'Get comparable properties in the area',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          radius: { type: 'number' }
        }
      },
      handler: async ({ address, radius }) => {
        // Fetch from Supabase or external API
        return await getComparables(address, radius);
      }
    }
  ]
});
```

**Pre-built MCP servers we can use:**
- `@modelcontextprotocol/server-postgres` - Direct Supabase access
- `@modelcontextprotocol/server-github` - If we store docs in GitHub
- `@modelcontextprotocol/server-slack` - For notifications

**Resources:**
- https://modelcontextprotocol.io
- https://github.com/modelcontextprotocol/servers

---

## ✅ Best Practices Checklist

### **1. Agent Design**

- ✅ **Single Responsibility:** Each agent does ONE thing well
- ✅ **Clear Prompts:** Be explicit about agent's role and constraints
- ✅ **Fail Gracefully:** Handle errors and edge cases
- ✅ **Idempotent:** Same input = same output (when possible)

**Example prompt structure:**
```typescript
const AGENT_PROMPT = `
You are the Input Manager Agent for a real estate platform.

Your ONLY job is to:
1. Validate property data completeness
2. Enhance the description for marketing
3. Suggest optimal pricing based on market data

DO NOT:
- Generate marketing content (that's Marketing Agent's job)
- Qualify leads (that's Lead Manager's job)
- Make pricing decisions (only suggest)

Output format: JSON with validated_data, enhanced_description, suggested_price
`;
```

### **2. Tool Usage**

- ✅ **Well-documented tools:** Clear descriptions and schemas
- ✅ **Minimal tools per agent:** 3-5 tools max
- ✅ **Validate tool outputs:** Don't trust blindly
- ✅ **Use MCP when possible:** Standard > custom

**Example tool definition:**
```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const analyzePropertyTool = tool(
  async ({ address, price, sqft }) => {
    // Implementation
    const comparables = await getMarketData(address);
    return {
      suggested_price: calculatePrice(comparables, sqft),
      confidence: 0.85,
      comparables: comparables.slice(0, 5)
    };
  },
  {
    name: 'analyze_property',
    description: 'Analyzes property and suggests optimal pricing based on market comparables within 1km radius',
    schema: z.object({
      address: z.string().describe('Full property address'),
      price: z.number().describe('Asking price in USD'),
      sqft: z.number().describe('Square footage')
    })
  }
);
```

### **3. State Management**

- ✅ **Minimal state:** Only store what's needed
- ✅ **Immutable updates:** Don't mutate state directly
- ✅ **Clear state schema:** TypeScript interfaces
- ✅ **Checkpoint frequently:** LangGraph does this automatically

**Example state:**
```typescript
interface PropertySalesState {
  // Core data
  propertyId: string;
  propertyData: PropertyData;
  
  // Agent outputs
  validatedData?: ValidatedProperty;
  marketingContent?: MarketingContent;
  qualifiedLeads?: Lead[];
  
  // Control flow
  currentStage: 'input' | 'marketing' | 'leads' | 'negotiation';
  requiresHumanReview: boolean;
  
  // Metadata
  startedAt: Date;
  lastUpdatedAt: Date;
}
```

### **4. Error Handling**

- ✅ **Retry logic:** LLMs can be flaky
- ✅ **Fallbacks:** Have backup plans
- ✅ **Human escalation:** Know when to ask for help
- ✅ **Logging:** Track everything for debugging

**Example:**
```typescript
async function executeAgent(agent: Agent, input: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await agent.execute(input);
      
      // Validate output
      if (!isValidOutput(result)) {
        throw new Error('Invalid agent output');
      }
      
      return result;
    } catch (error) {
      console.error(`Agent failed (attempt ${i + 1}/${retries}):`, error);
      
      if (i === retries - 1) {
        // Final attempt failed, escalate to human
        await notifyHuman({
          agent: agent.name,
          input,
          error: error.message,
          requiresReview: true
        });
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### **5. Testing & Evaluation**

- ✅ **Unit test each agent:** Isolated testing
- ✅ **Integration test workflow:** End-to-end
- ✅ **Eval sets:** Curated test cases
- ✅ **Monitor in production:** Track success rates

**Example eval:**
```typescript
const testCases = [
  {
    input: { /* property data */ },
    expected: {
      stage: 'completed',
      leadsGenerated: { min: 1, max: 10 },
      marketingQuality: { min: 0.7 }
    }
  }
];

for (const testCase of testCases) {
  const result = await workflow.execute(testCase.input);
  assert(result.leadsGenerated >= testCase.expected.leadsGenerated.min);
}
```

---

## 🚀 Implementation Recommendations for Century AI 21

### **Phase 1: Simple Workflow (Weeks 1-6)**

```typescript
// Start with linear workflow
workflow.addNode("input_manager", inputManagerAgent);
workflow.addNode("marketing", marketingAgent);
workflow.addNode("lead_manager", leadManagerAgent);

workflow.addEdge("input_manager", "marketing");
workflow.addEdge("marketing", "lead_manager");
workflow.addEdge("lead_manager", END);
```

**Why:** Simplest to build and debug

### **Phase 2: Add Conditional Logic (Weeks 7-9)**

```typescript
// Add conditional routing
workflow.addConditionalEdges(
  "lead_manager",
  (state) => {
    if (state.qualifiedLeads.length > 0) {
      return "negotiation";
    }
    return END;
  }
);
```

**Why:** Handle real-world scenarios

### **Phase 3: Optimize with Parallelization (Weeks 10+)**

```typescript
// Run multiple marketing tasks in parallel
async function marketingAgent(state) {
  const [socialPosts, listings, images] = await Promise.all([
    generateSocialMedia(state.propertyData),
    generateListings(state.propertyData),
    optimizeImages(state.propertyData.images)
  ]);
  
  return { marketingContent: { socialPosts, listings, images } };
}
```

**Why:** Speed up execution

---

## 💰 Cost Optimization Tips

### **1. Use Smaller Models When Possible**

```typescript
// Simple tasks → Haiku (cheap)
// Complex tasks → Sonnet (expensive)

const model = isComplexTask(task) 
  ? new ChatAnthropic({ model: 'claude-sonnet-4.5' })
  : new ChatAnthropic({ model: 'claude-haiku-4' });
```

### **2. Cache System Prompts**

```typescript
// Anthropic supports prompt caching
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4.5',
  system: [
    {
      type: 'text',
      text: LONG_SYSTEM_PROMPT, // This gets cached
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: [...]
});
```

**Savings:** Up to 90% cost reduction on repeated prompts

### **3. Batch When Possible**

```typescript
// Instead of 10 separate calls
for (const lead of leads) {
  await qualifyLead(lead); // $$$
}

// Batch into one call
await qualifyLeads(leads); // $
```

---

## 🎯 Key Takeaways

1. **Start with workflows, not autonomous agents** - More predictable
2. **Use prompt chaining** - Break complex tasks into steps
3. **Leverage MCP** - Standard tools > custom integrations
4. **Test extensively** - Agents are non-deterministic
5. **Monitor costs** - LLMs are expensive at scale
6. **Human-in-the-loop** - Know when to escalate
7. **Keep it simple** - Don't over-engineer

---

## 📚 Resources

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [LangGraph Workflows](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)

---

## ✅ Next Steps for Implementation

1. Define clear system prompts for each agent
2. Implement tools using MCP standard
3. Start with linear workflow (no conditionals)
4. Add extensive logging for debugging
5. Create eval set with 10 test properties
6. Monitor token usage and costs
