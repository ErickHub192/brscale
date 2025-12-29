# Closure Agent: Production Roadmap

**Current Status**: MVP with hardcoded completion statuses for demos
**Document Purpose**: Define how Closure Agent will work in production after MVP validation

---

## Table of Contents

1. [Current MVP Implementation](#current-mvp-implementation)
2. [Phase 1: Manual Tracking (Post-Demo)](#phase-1-manual-tracking-post-demo)
3. [Phase 2: Partial Automation](#phase-2-partial-automation)
4. [Phase 3: Full Integration](#phase-3-full-integration)
5. [Technical Implementation Details](#technical-implementation-details)
6. [Integration Requirements](#integration-requirements)
7. [Security & Compliance](#security--compliance)

---

## Current MVP Implementation

### What Works Now (December 2025)

**Hardcoded Status for Demos**:
```typescript
// ClosureAgent.ts - Line 347-379
const criticalChecks = [
  {
    name: 'Purchase contract signed',
    completed: true, // MVP: Simulated for demo
    blocker: true,
  },
  {
    name: 'Buyer financing approved',
    completed: true, // MVP: Simulated for demo
    blocker: true,
  },
  // ... all tasks hardcoded as completed
];
```

**Purpose**: Validate product-market fit with brokers before building complex integrations

**Limitations**:
- ❌ No real document tracking
- ❌ No external service integrations
- ❌ Broker cannot manually update task status
- ❌ No audit trail of task completions

---

## Phase 1: Manual Tracking (Post-Demo)

**Timeline**: 2-4 weeks after successful demos
**Investment**: Low ($500-1K development cost)
**Value**: Brokers can actually use the system for real transactions

### User Flow

```
Legal Agent generates PDFs
    ↓
Broker downloads PDFs from BR SCALE
    ↓
Broker sends PDFs to buyer/seller via:
  - Email
  - DocuSign (broker's own account)
  - Physical mail
    ↓
Buyer/seller signs documents externally
    ↓
Broker returns to BR SCALE Dashboard
    ↓
Broker checks ✅ "Purchase contract signed"
    ↓
Closure Agent detects progress and updates status
    ↓
When all tasks ✅, Closure Agent requests final confirmation
```

### UI Implementation

**Closure Dashboard Component** (`app/dashboard/[propertyId]/closure/page.tsx`):

```tsx
'use client';

import { useState } from 'react';

interface ClosureTask {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  isBlocker: boolean;
  completedAt?: Date;
  completedBy?: string;
}

export default function ClosureDashboard({ propertyId }: { propertyId: string }) {
  const [tasks, setTasks] = useState<ClosureTask[]>([
    {
      id: 'contract_signed',
      name: 'Purchase contract signed',
      description: 'All parties have signed the purchase agreement',
      completed: false,
      isBlocker: true,
    },
    {
      id: 'financing_approved',
      name: 'Buyer financing approved',
      description: 'Lender has approved buyer loan application',
      completed: false,
      isBlocker: true,
    },
    {
      id: 'inspection_complete',
      name: 'Home inspection completed',
      description: 'Professional home inspection finished',
      completed: false,
      isBlocker: false,
    },
    {
      id: 'title_search',
      name: 'Title search completed',
      description: 'Title company verified clean title',
      completed: false,
      isBlocker: true,
    },
    {
      id: 'insurance',
      name: 'Homeowners insurance obtained',
      description: 'Buyer has secured homeowners insurance',
      completed: false,
      isBlocker: true,
    },
    {
      id: 'final_walkthrough',
      name: 'Final walkthrough completed',
      description: 'Buyer final property inspection done',
      completed: false,
      isBlocker: false,
    },
  ]);

  const handleTaskToggle = async (taskId: string) => {
    // Update UI optimistically
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? new Date() : undefined,
              completedBy: !task.completed ? 'Broker Name' : undefined, // TODO: Get from auth
            }
          : task
      )
    );

    // Persist to backend
    await fetch(`/api/properties/${propertyId}/closure/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        completed: !tasks.find((t) => t.id === taskId)?.completed,
        completedAt: new Date(),
      }),
    });

    // Notify workflow to re-evaluate closure status
    await fetch(`/api/workflow/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: `prop_${propertyId}`,
        userMessage: '__SYSTEM_TASK_UPDATE__', // Special message to trigger re-evaluation
      }),
    });
  };

  const blockers = tasks.filter((t) => t.isBlocker && !t.completed);
  const allTasksComplete = tasks.every((t) => t.completed);

  return (
    <div className="closure-dashboard">
      <h2>Closing Checklist</h2>

      {blockers.length > 0 && (
        <div className="alert alert-warning">
          ⚠️ {blockers.length} critical items blocking closing
        </div>
      )}

      {allTasksComplete && (
        <div className="alert alert-success">
          ✅ All tasks complete! Ready to finalize transaction.
        </div>
      )}

      <div className="task-list">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`task-item ${task.completed ? 'completed' : ''} ${
              task.isBlocker ? 'blocker' : ''
            }`}
          >
            <label>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleTaskToggle(task.id)}
              />
              <div className="task-content">
                <h4>
                  {task.name}
                  {task.isBlocker && <span className="badge">Critical</span>}
                </h4>
                <p>{task.description}</p>
                {task.completed && task.completedAt && (
                  <small className="completion-info">
                    Completed {task.completedAt.toLocaleDateString()} by {task.completedBy}
                  </small>
                )}
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Backend API Endpoint

**`app/api/properties/[propertyId]/closure/tasks/route.ts`**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/infrastructure/database/supabase/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { propertyId: string } }
) {
  const { taskId, completed, completedAt } = await request.json();
  const { propertyId } = params;

  // TODO: Get userId from auth session
  const userId = 'broker-user-id';

  // Update closure_tasks table
  const { data, error } = await supabaseAdmin
    .from('closure_tasks')
    .upsert({
      property_id: propertyId,
      task_id: taskId,
      completed,
      completed_at: completed ? completedAt : null,
      completed_by: completed ? userId : null,
      updated_at: new Date(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { propertyId: string } }
) {
  const { propertyId } = params;

  // Fetch all tasks for this property
  const { data, error } = await supabaseAdmin
    .from('closure_tasks')
    .select('*')
    .eq('property_id', propertyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}
```

### Database Schema

**New Table: `closure_tasks`**

```sql
-- Migration: supabase/migrations/YYYYMMDD_create_closure_tasks.sql

CREATE TABLE closure_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL, -- 'contract_signed', 'financing_approved', etc.
  task_name TEXT NOT NULL,
  task_description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  is_blocker BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per task per property
  UNIQUE(property_id, task_id)
);

-- Index for fast lookups
CREATE INDEX idx_closure_tasks_property ON closure_tasks(property_id);
CREATE INDEX idx_closure_tasks_completed ON closure_tasks(property_id, completed);

-- Enable RLS
ALTER TABLE closure_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Brokers can manage tasks for their properties
CREATE POLICY "Brokers can manage closure tasks"
  ON closure_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = closure_tasks.property_id
      AND properties.broker_id = auth.uid()
    )
  );
```

### ClosureAgent Update

**Read tasks from database instead of hardcoding**:

```typescript
// ClosureAgent.ts - Updated generateClosureStatus()
private async generateClosureStatus(state: PropertyWorkflowStateType): Promise<{
  readyForClosing: boolean;
  allChecklistItemsComplete: boolean;
  completedItems: string[];
  pendingItems: string[];
  blockers: string[];
}> {
  const completedItems: string[] = [];
  const pendingItems: string[] = [];
  const blockers: string[] = [];

  // Fetch tasks from database
  const { data: tasks, error } = await supabaseAdmin
    .from('closure_tasks')
    .select('*')
    .eq('property_id', state.propertyId);

  if (error) {
    this.logError('Failed to fetch closure tasks', error);
    throw new Error('Could not load closure tasks');
  }

  // Process each task
  tasks.forEach((task) => {
    if (task.completed) {
      completedItems.push(task.task_name);
    } else {
      pendingItems.push(task.task_name);
      if (task.is_blocker) {
        blockers.push(task.task_name);
      }
    }
  });

  const allChecklistItemsComplete = pendingItems.length === 0;
  const readyForClosing = blockers.length === 0;

  return {
    readyForClosing,
    allChecklistItemsComplete,
    completedItems,
    pendingItems,
    blockers,
  };
}
```

### Deliverables for Phase 1

- ✅ Closure Dashboard UI with manual checkboxes
- ✅ API endpoint to update task status
- ✅ Database schema for task persistence
- ✅ ClosureAgent reads from database instead of hardcoded values
- ✅ Audit trail (who completed, when)

**Estimated Effort**: 2-3 days development + 1 day testing

---

## Phase 2: Partial Automation

**Timeline**: 3-6 months after launch (if product gains traction)
**Investment**: Medium ($5K-15K development + API costs)
**Value**: Reduce manual work, improve accuracy

### What Gets Automated

| Task | Integration | API | Confidence |
|------|-------------|-----|------------|
| **Document Signatures** | DocuSign | ✅ Yes | High |
| **Financing Status** | Plaid/Blend | ✅ Yes | Medium |
| **Title Search** | Title company APIs | ⚠️ Limited | Low |
| **Insurance** | Insurance APIs | ⚠️ Limited | Low |
| **Inspection** | Manual (no standard API) | ❌ No | N/A |

### Implementation: DocuSign Integration

**Why DocuSign First?**
- Most critical task (contract signatures)
- Well-documented API
- Common in real estate industry
- High ROI (saves most manual work)

#### Step 1: DocuSign API Setup

```typescript
// src/infrastructure/services/DocuSignService.ts

import axios from 'axios';
import { env } from '@/infrastructure/config/env';

export class DocuSignService {
  private baseUrl = 'https://demo.docusign.net/restapi';
  private accountId: string;
  private accessToken: string;

  constructor() {
    this.accountId = env.DOCUSIGN_ACCOUNT_ID;
    this.accessToken = env.DOCUSIGN_ACCESS_TOKEN; // TODO: Implement OAuth refresh
  }

  /**
   * Send contract for signature
   */
  async sendContractForSignature(
    contractUrl: string,
    signers: { name: string; email: string; role: 'buyer' | 'seller' }[]
  ): Promise<{ envelopeId: string; signingUrl: string }> {
    // 1. Download PDF from Supabase
    const pdfBuffer = await this.downloadPDF(contractUrl);

    // 2. Create DocuSign envelope
    const envelope = {
      emailSubject: 'Please sign the purchase contract',
      documents: [
        {
          documentBase64: pdfBuffer.toString('base64'),
          name: 'Purchase Contract',
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: signers.map((signer, idx) => ({
          email: signer.email,
          name: signer.name,
          recipientId: String(idx + 1),
          routingOrder: String(idx + 1),
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                xPosition: '100',
                yPosition: '100',
              },
            ],
          },
        })),
      },
      status: 'sent',
    };

    const response = await axios.post(
      `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`,
      envelope,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      envelopeId: response.data.envelopeId,
      signingUrl: response.data.uri, // Embedded signing URL
    };
  }

  /**
   * Check if envelope is fully signed
   */
  async checkSignatureStatus(envelopeId: string): Promise<{
    allSigned: boolean;
    signers: { name: string; status: string }[];
  }> {
    const response = await axios.get(
      `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    const signers = response.data.recipients.signers.map((signer: any) => ({
      name: signer.name,
      status: signer.status, // 'sent', 'delivered', 'signed', 'completed'
    }));

    const allSigned = signers.every((s: any) => s.status === 'completed');

    return { allSigned, signers };
  }

  private async downloadPDF(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
}
```

#### Step 2: DocuSign Webhook Handler

**`app/api/webhooks/docusign/route.ts`**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/infrastructure/database/supabase/client';

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // Verify webhook authenticity (HMAC signature)
  // TODO: Implement signature verification

  const { event, envelopeId, status } = payload;

  if (event === 'envelope-completed') {
    // All parties have signed
    console.log(`Envelope ${envelopeId} completed`);

    // Find property by envelope ID
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('docusign_envelope_id', envelopeId)
      .single();

    if (property) {
      // Update closure task
      await supabaseAdmin
        .from('closure_tasks')
        .update({
          completed: true,
          completed_at: new Date(),
          completed_by: null, // System completion
        })
        .eq('property_id', property.id)
        .eq('task_id', 'contract_signed');

      console.log(`✅ Auto-completed: Purchase contract signed for property ${property.id}`);
    }
  }

  return NextResponse.json({ received: true });
}
```

#### Step 3: LegalAgent Sends to DocuSign

**Update `LegalAgent.ts` to automatically send contract for signatures**:

```typescript
// After generating contract PDF
const contractResult = await contractTool.func({ ... });
const contract = JSON.parse(contractResult);

// Send to DocuSign for signatures
const docuSignService = new DocuSignService();
const { envelopeId, signingUrl } = await docuSignService.sendContractForSignature(
  contract.documentUrl,
  [
    { name: 'Jane Buyer', email: 'buyer@example.com', role: 'buyer' },
    { name: 'John Seller', email: 'seller@example.com', role: 'seller' },
  ]
);

// Store envelope ID for tracking
await supabaseAdmin
  .from('properties')
  .update({ docusign_envelope_id: envelopeId })
  .eq('id', propertyId);

this.log('Contract sent to DocuSign', { envelopeId, signingUrl });
```

### Implementation: Plaid for Financing Verification

**Why Plaid?**
- Connects to 12,000+ financial institutions
- Can verify buyer's bank balance and income
- Real-time loan approval status (via lender integrations)

```typescript
// src/infrastructure/services/PlaidService.ts

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

export class PlaidService {
  private client: PlaidApi;

  constructor() {
    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox, // Use 'production' in prod
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });
    this.client = new PlaidApi(configuration);
  }

  /**
   * Verify buyer has sufficient funds for down payment
   */
  async verifyDownPaymentFunds(
    accessToken: string,
    requiredAmount: number
  ): Promise<{ verified: boolean; availableFunds: number }> {
    const response = await this.client.accountsBalanceGet({ access_token: accessToken });

    const totalBalance = response.data.accounts.reduce(
      (sum, account) => sum + (account.balances.available || 0),
      0
    );

    return {
      verified: totalBalance >= requiredAmount,
      availableFunds: totalBalance,
    };
  }

  /**
   * Check mortgage approval status via Blend/lender integration
   */
  async checkMortgageApprovalStatus(loanApplicationId: string): Promise<{
    approved: boolean;
    status: 'pending' | 'approved' | 'denied' | 'conditional';
  }> {
    // TODO: Integrate with Blend API or lender's API
    // This is a placeholder - actual implementation depends on lender
    return { approved: false, status: 'pending' };
  }
}
```

### Deliverables for Phase 2

- ✅ DocuSign integration for contract signatures (auto-completes "contract signed")
- ✅ Plaid integration for financing verification (auto-completes "financing approved")
- ✅ Webhook handlers to receive external status updates
- ✅ Fallback to manual checkboxes if integrations fail
- ✅ Audit trail showing automated vs manual completions

**Estimated Effort**: 2-3 weeks development + 1 week integration testing

---

## Phase 3: Full Integration

**Timeline**: 12-18 months (if scaling to 100+ brokers)
**Investment**: High ($50K-100K + ongoing API costs)
**Value**: Fully automated closing coordination

### Additional Integrations

#### Title Company APIs
- **Providers**: First American, Stewart Title, Fidelity National
- **Challenge**: Limited public APIs, mostly manual processes
- **Solution**: Partner with title companies for direct integration

#### Insurance APIs
- **Providers**: Hippo, Lemonade, State Farm (limited API access)
- **Challenge**: Insurance shopping is complex, not standardized
- **Solution**: Integrate with insurance marketplaces (PolicyGenius, Policygenius)

#### Home Inspection Scheduling
- **Providers**: Spectora, HomeGauge (inspection report software)
- **Challenge**: No standard API for scheduling
- **Solution**: Calendar integration (Google Calendar, Calendly) + manual confirmation

### Advanced Features

**1. Predictive Closing Date**
```typescript
// Use ML to predict actual closing date based on task completion velocity
const predictedClosingDate = await aiService.predictClosingDate({
  originalClosingDate: offer.closingDate,
  tasksCompleted: completedItems.length,
  tasksRemaining: pendingItems.length,
  averageCompletionTime: calculateAverageTaskTime(),
  propertyType: property.propertyType,
  state: property.address.state,
});
```

**2. Automated Reminders**
```typescript
// Send automated reminders for pending tasks
if (task.daysOverdue > 3 && !task.completed) {
  await emailService.send({
    to: task.assignedTo,
    subject: `Reminder: ${task.name} is overdue`,
    body: `The task "${task.name}" was due ${task.daysOverdue} days ago...`,
  });
}
```

**3. Compliance Monitoring**
```typescript
// Verify compliance with state-specific requirements
const complianceCheck = await complianceService.checkStateRequirements({
  state: property.address.state,
  propertyType: property.propertyType,
  transactionType: 'sale',
  documents: state.legalDocuments,
});

if (!complianceCheck.passed) {
  await notifyBroker({
    alert: 'Compliance Issue',
    missing: complianceCheck.missingRequirements,
  });
}
```

---

## Technical Implementation Details

### Architecture Pattern: Event-Driven Updates

```
External Service (DocuSign/Plaid/etc.)
    ↓ (webhook)
Webhook Handler (/api/webhooks/*)
    ↓
Update Database (closure_tasks table)
    ↓
Emit Event (Redis Pub/Sub or Supabase Realtime)
    ↓
ClosureAgent subscribes to events
    ↓
Re-evaluate closure status
    ↓
Update workflow state
    ↓
Notify broker via UI (real-time update)
```

### State Machine for Task Status

```typescript
type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_external' // Waiting for DocuSign, Plaid, etc.
  | 'completed'
  | 'failed'
  | 'manually_overridden';

interface TaskTransition {
  from: TaskStatus;
  to: TaskStatus;
  trigger: 'user_action' | 'webhook' | 'timeout' | 'manual_override';
  timestamp: Date;
  triggeredBy: string; // userId or 'system'
}
```

### Error Handling & Fallbacks

**If external integration fails**:
```typescript
try {
  // Try automated check via DocuSign
  const { allSigned } = await docuSignService.checkSignatureStatus(envelopeId);

  if (allSigned) {
    await markTaskCompleted('contract_signed', 'system');
  }
} catch (error) {
  // Fallback to manual checkbox
  console.error('DocuSign API failed, falling back to manual verification');

  await notifyBroker({
    message: 'Automated signature check failed. Please verify manually.',
    action: 'check_docusign_manually',
  });

  // Task remains unchecked until broker manually confirms
}
```

---

## Integration Requirements

### Phase 1: Manual Tracking
- ✅ Next.js 16+ (already have)
- ✅ Supabase (already have)
- ✅ React 19+ (already have)
- **New**: Database migration for `closure_tasks` table

### Phase 2: Partial Automation
- **DocuSign Account**: Enterprise plan ($60/month + $1/envelope)
- **Plaid Account**: Growth plan ($0.30/user/month)
- **Environment Variables**:
  ```bash
  DOCUSIGN_ACCOUNT_ID=xxx
  DOCUSIGN_ACCESS_TOKEN=xxx
  DOCUSIGN_INTEGRATION_KEY=xxx
  PLAID_CLIENT_ID=xxx
  PLAID_SECRET=xxx
  PLAID_ENV=sandbox # or production
  ```

### Phase 3: Full Integration
- **Title API**: Custom integration (varies by provider)
- **Insurance API**: PolicyGenius API (pricing TBD)
- **ML/AI Service**: OpenAI API for predictive analytics (existing)
- **Monitoring**: Sentry for error tracking, Datadog for API monitoring

---

## Security & Compliance

### Data Privacy

**Sensitive Data Handling**:
- ✅ All document URLs use **signed URLs** (7-day expiry)
- ✅ Supabase RLS policies restrict data access to property owner
- ✅ DocuSign uses **OAuth 2.0** for authentication
- ✅ Plaid uses **end-to-end encryption** for financial data

**GDPR/CCPA Compliance**:
- User can delete all closure tasks via `/api/user/delete-data`
- Audit trail retained for 7 years (legal requirement in real estate)
- Third-party integrations (DocuSign, Plaid) must be GDPR-compliant

### API Security

**Webhook Verification**:
```typescript
// Verify DocuSign webhook signature
function verifyDocuSignWebhook(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.DOCUSIGN_WEBHOOK_SECRET);
  const expectedSignature = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Rate Limiting**:
```typescript
// Prevent API abuse
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

export default limiter;
```

---

## Cost Analysis

### Phase 1: Manual Tracking
- **Development**: $1,500 (3 days @ $500/day)
- **Ongoing**: $0/month (uses existing infrastructure)

### Phase 2: Partial Automation
- **Development**: $10,000 (2-3 weeks @ $500/day)
- **DocuSign**: $60/month + $1/envelope (~$200/month for 140 envelopes)
- **Plaid**: $0.30/user/month (~$50/month for 150 users)
- **Total Monthly**: ~$310/month

### Phase 3: Full Integration
- **Development**: $75,000 (3 months @ $25K/month)
- **APIs**: ~$500-1K/month (title, insurance, monitoring)
- **Infrastructure**: ~$200/month (Redis, additional Supabase storage)
- **Total Monthly**: ~$1,000-1,500/month

---

## Success Metrics

### Phase 1 KPIs
- **Task Completion Rate**: % of tasks completed vs created
- **Time to Closure**: Days from Legal → Closure completion
- **Broker Satisfaction**: NPS score for closure process

### Phase 2 KPIs
- **Automation Rate**: % of tasks auto-completed vs manual
- **API Uptime**: 99.5%+ for DocuSign/Plaid integrations
- **Error Rate**: <1% failed webhook/API calls

### Phase 3 KPIs
- **End-to-End Automation**: % of closures with zero manual intervention
- **Predicted vs Actual Closing Date**: Accuracy within ±3 days
- **Cost Savings**: Hours saved per transaction vs manual process

---

## Decision Tree: When to Implement Each Phase

```
MVP Validated with 5+ Paying Customers?
    ↓ NO → Stay in Phase 0 (MVP with hardcoded values)
    ↓ YES
    ↓
Brokers manually tracking 10+ transactions?
    ↓ NO → Stay in Phase 0
    ↓ YES → Implement Phase 1 (Manual Tracking UI)
    ↓
Are signatures a major pain point? (>30% of broker time)
    ↓ NO → Stay in Phase 1
    ↓ YES → Implement Phase 2 (DocuSign Integration)
    ↓
Managing 100+ transactions/month?
    ↓ NO → Stay in Phase 2
    ↓ YES → Implement Phase 3 (Full Integration)
```

---

## Conclusion

**Current Status**: MVP ready for demos with hardcoded completion statuses

**Next Steps After Successful Demo**:
1. ✅ Validate product-market fit with 3-5 pilot brokers
2. ✅ Gather feedback on which tasks are most painful (likely signatures)
3. ✅ Implement Phase 1 (manual tracking) if pilots convert to paying customers
4. ✅ Monitor usage patterns to decide if Phase 2/3 are justified

**Key Principle**: Build integrations **only after validating demand**. Don't prematurely optimize.

**Last Updated**: December 28, 2025
**Author**: BR SCALE Engineering Team
