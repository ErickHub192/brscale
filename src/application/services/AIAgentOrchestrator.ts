/**
 * AI Agent Orchestrator Service
 * Coordinates the multi-agent LangGraph workflow for property processing
 */

import { Property } from '@/domain/entities';
import { AGENT_TYPES, AgentType } from '@/infrastructure/config/env';
import {
  executePropertyWorkflow,
  resumePropertyWorkflow,
  getPropertyWorkflowState,
  getPropertyWorkflowHistory,
} from '@/infrastructure/ai/workflow/PropertySalesWorkflow';
import { PropertyWorkflowStateType, WorkflowStage } from '@/infrastructure/ai/types/WorkflowState';

export interface WorkflowStatus {
  propertyId: string;
  currentStage: WorkflowStage;
  completed: boolean;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  humanInterventionRequired?: boolean;
  agentOutputs?: Record<string, any>;
}

export interface AgentExecutionResult {
  agentType: AgentType;
  success: boolean;
  output: Record<string, unknown>;
  executionTimeMs: number;
  error?: string;
}

export class AIAgentOrchestratorService {
  /**
   * Start the AI workflow for a property
   * Triggers the LangGraph multi-agent workflow
   */
  async startPropertyWorkflow(property: Property): Promise<WorkflowStatus> {
    const propertyData = property.toJSON();
    const propertyId = propertyData.id;

    try {
      console.log('[AIAgentOrchestrator] Starting workflow for property:', propertyId);

      // Create initial workflow state
      const initialState: PropertyWorkflowStateType = {
        propertyId,
        property: propertyData,
        stage: 'input_validation',
        humanInterventionRequired: false,
        humanResponse: undefined,
        humanRole: undefined,
        currentLeadId: undefined,
        workflowStartedAt: new Date(),
        workflowCompletedAt: null,
        agentOutputs: {},
        marketingContent: null,
        leads: [],
        qualifiedLeads: [],
        leadConversations: {}, // Initialize lead conversations
        currentOffer: null,
        offerHistory: [],
        legalDocuments: null,
        messages: [], // Initialize conversation history
        errors: [],
        retryCount: 0,
      };

      // Execute the workflow
      const result = await executePropertyWorkflow(initialState);

      console.log('[AIAgentOrchestrator] Workflow execution complete', {
        propertyId,
        finalStage: result.stage,
        humanInterventionRequired: result.humanInterventionRequired,
      });

      return {
        propertyId,
        currentStage: result.stage,
        completed: result.stage === 'completed',
        startedAt: result.workflowStartedAt,
        completedAt: result.workflowCompletedAt || undefined,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        humanInterventionRequired: result.humanInterventionRequired,
        agentOutputs: result.agentOutputs,
      };
    } catch (error) {
      console.error('[AIAgentOrchestrator] Workflow execution failed:', error);

      return {
        propertyId,
        currentStage: 'input_validation',
        completed: false,
        startedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        humanInterventionRequired: true,
      };
    }
  }

  /**
   * Get the current workflow status for a property
   * Retrieves state from LangGraph checkpoint
   */
  async getWorkflowStatus(propertyId: string): Promise<WorkflowStatus | null> {
    try {
      console.log('[AIAgentOrchestrator] Getting workflow status for:', propertyId);

      const state = await getPropertyWorkflowState(propertyId);

      if (!state) {
        console.log('[AIAgentOrchestrator] No workflow found for property:', propertyId);
        return null;
      }

      // Use __interrupted to detect if workflow is paused waiting for human input
      const humanInterventionRequired = state.__interrupted || state.humanInterventionRequired || false;

      console.log('[AIAgentOrchestrator] Workflow status:', {
        propertyId,
        stage: state.stage,
        __interrupted: state.__interrupted,
        humanInterventionRequired,
      });

      return {
        propertyId,
        currentStage: state.stage,
        completed: state.stage === 'completed',
        startedAt: state.workflowStartedAt,
        completedAt: state.workflowCompletedAt || undefined,
        error: state.errors && state.errors.length > 0 ? state.errors.join('; ') : undefined,
        humanInterventionRequired,
        agentOutputs: state.agentOutputs,
      };
    } catch (error) {
      console.error('[AIAgentOrchestrator] Failed to get workflow status:', error);
      return null;
    }
  }

  /**
   * Resume a workflow from an interrupt with human response
   * Uses LangGraph Command pattern to resume from interrupt()
   */
  async resumeWorkflow(
    propertyId: string,
    context: {
      humanResponse: string;
      humanRole?: 'broker' | 'lead';
      leadId?: string;
      leadEmail?: string;
      leadPhone?: string;
    }
  ): Promise<WorkflowStatus> {
    try {
      console.log('[AIAgentOrchestrator] Resuming workflow for property:', propertyId, {
        humanResponse: context.humanResponse,
        humanRole: context.humanRole,
        leadId: context.leadId,
      });

      const result = await resumePropertyWorkflow(propertyId, context);

      console.log('[AIAgentOrchestrator] Workflow resumed successfully', {
        propertyId,
        finalStage: result.stage,
      });

      return {
        propertyId,
        currentStage: result.stage,
        completed: result.stage === 'completed',
        startedAt: result.workflowStartedAt,
        completedAt: result.workflowCompletedAt || undefined,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        humanInterventionRequired: result.humanInterventionRequired,
        agentOutputs: result.agentOutputs,
      };
    } catch (error) {
      console.error('[AIAgentOrchestrator] Failed to resume workflow:', error);
      throw error;
    }
  }

  /**
   * Get the complete workflow history for a property
   * Shows all checkpoint states and agent executions
   */
  async getWorkflowHistory(propertyId: string): Promise<any[]> {
    try {
      console.log('[AIAgentOrchestrator] Getting workflow history for:', propertyId);

      const history = await getPropertyWorkflowHistory(propertyId);

      return history;
    } catch (error) {
      console.error('[AIAgentOrchestrator] Failed to get workflow history:', error);
      return [];
    }
  }
}

