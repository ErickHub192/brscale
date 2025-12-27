/**
 * LangGraph Workflow State
 * This is the central state that flows through all agents in the workflow
 */

import { Annotation } from '@langchain/langgraph';
import { PropertyData } from '@/domain/entities/Property';

export type WorkflowStage =
  | 'input_validation'
  | 'marketing'
  | 'lead_management'
  | 'negotiation'
  | 'legal'
  | 'closure'
  | 'completed';

export interface Lead {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone?: string;
  source: 'whatsapp' | 'email' | 'web' | 'referral';
  qualificationScore: number; // 0-100
  status: 'new' | 'qualified' | 'contacted' | 'visit_scheduled' | 'offer_made' | 'rejected';
  notes: string;
  createdAt: Date;
  lastContactedAt?: Date;
}

export interface Offer {
  id: string;
  propertyId: string;
  leadId: string;
  amount: number;
  conditions: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'counter_offered';
  counterOfferAmount?: number;
  counterOfferConditions?: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface MarketingContent {
  socialPosts: {
    platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin';
    content: string;
    hashtags: string[];
    imageUrl?: string;
  }[];
  listingDescription: string;
  seoKeywords: string[];
  emailCampaign?: {
    subject: string;
    body: string;
    targetAudience: string;
  };
}

export interface LegalDocuments {
  contractTemplate?: string;
  disclosures: string[];
  inspectionChecklist: string[];
  closingChecklist: string[];
  status: 'draft' | 'review' | 'ready';
}

export interface AgentOutput {
  agentName: string;
  timestamp: Date;
  success: boolean;
  data: any;
  errors?: string[];
  nextAction?: string;
}

export interface ConversationMessage {
  role: 'human' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string;
}

export interface LeadConversation {
  leadId: string;
  leadName: string;
  leadEmail: string;
  messages: ConversationMessage[];
  lastContact: Date;
  status: 'active' | 'waiting_response' | 'qualified' | 'ready_for_offer' | 'cold';
  qualificationScore: number; // 0-100, updated based on conversation
}

/**
 * LangGraph State Annotation
 * Defines the structure of the state that flows through the workflow
 */
export const PropertyWorkflowState = Annotation.Root({
  // Core property data
  propertyId: Annotation<string>,
  property: Annotation<PropertyData>,

  // Workflow control
  stage: Annotation<WorkflowStage>,
  humanInterventionRequired: Annotation<boolean>,
  humanResponse: Annotation<string | undefined>,
  humanRole: Annotation<'broker' | 'lead' | undefined>, // Who is responding: broker or lead
  currentLeadId: Annotation<string | undefined>, // If humanRole is 'lead', which lead is it
  workflowStartedAt: Annotation<Date>,
  workflowCompletedAt: Annotation<Date | null>,

  // Agent outputs
  agentOutputs: Annotation<Record<string, AgentOutput>>,

  // Marketing stage
  marketingContent: Annotation<MarketingContent | null>,

  // Lead management stage
  leads: Annotation<Lead[]>,
  qualifiedLeads: Annotation<Lead[]>,
  leadConversations: Annotation<Record<string, LeadConversation>>, // Conversations indexed by leadId

  // Negotiation stage
  currentOffer: Annotation<Offer | null>,
  offerHistory: Annotation<Offer[]>,

  // Legal stage
  legalDocuments: Annotation<LegalDocuments | null>,

  // Conversation history (for multi-turn human-agent conversations)
  messages: Annotation<ConversationMessage[]>,

  // Error handling
  errors: Annotation<string[]>,
  retryCount: Annotation<number>,
});

export type PropertyWorkflowStateType = typeof PropertyWorkflowState.State;
