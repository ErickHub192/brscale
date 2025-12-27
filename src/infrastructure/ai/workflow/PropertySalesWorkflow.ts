/**
 * Property Sales Workflow
 * LangGraph StateGraph connecting all 6 AI agents in a sequential workflow
 */

import { StateGraph, END, START, Command } from '@langchain/langgraph';
import { PropertyWorkflowState, PropertyWorkflowStateType } from '../types/WorkflowState';
import { getCheckpointSaver } from '../checkpointing/PostgresCheckpointSaver';

// Import all agents
import { InputManagerAgent } from '../agents/InputManagerAgent';
import { MarketingAgent } from '../agents/MarketingAgent';
import { LeadManagerAgent } from '../agents/LeadManagerAgent';
import { NegotiationAgent } from '../agents/NegotiationAgent';
import { LegalAgent } from '../agents/LegalAgent';
import { ClosureAgent } from '../agents/ClosureAgent';

// Import human node for multi-turn conversations
import { humanNode } from './HumanNode';

/**
 * Create the Property Sales Workflow Graph
 */
export async function createPropertySalesWorkflow() {
  // Initialize all agents
  const inputManagerAgent = new InputManagerAgent();
  const marketingAgent = new MarketingAgent();
  const leadManagerAgent = new LeadManagerAgent();
  const negotiationAgent = new NegotiationAgent();
  const legalAgent = new LegalAgent();
  const closureAgent = new ClosureAgent();

  // Create the StateGraph with method chaining for proper TypeScript inference
  const workflow = new StateGraph(PropertyWorkflowState)
    // Add all nodes (agents)
    .addNode('input_validation', async (state: PropertyWorkflowStateType) => {
      console.log('[Workflow] Executing Input Manager Agent');
      return await inputManagerAgent.execute(state);
    })
    .addNode('marketing', async (state: PropertyWorkflowStateType) => {
      console.log('[Workflow] Executing Marketing Agent');
      return await marketingAgent.execute(state);
    })
    .addNode('lead_management', async (state: PropertyWorkflowStateType) => {
      console.log('[Workflow] Executing Lead Manager Agent');
      return await leadManagerAgent.execute(state);
    }, { ends: ['human', 'negotiation', END] })  // Lead Manager can route to human node or negotiation
    .addNode('negotiation', async (state: PropertyWorkflowStateType) => {
      console.log('[Workflow] Executing Negotiation Agent');
      const result = await negotiationAgent.execute(state);
      console.log('[Workflow] Negotiation Agent returned:', {
        isCommand: result instanceof Command,
        result: result,
      });
      return result;
    }, { ends: ['human', 'legal', END] })  // Negotiation can route to human node or legal
    .addNode('legal', async (state: PropertyWorkflowStateType) => {
      console.log('[Workflow] Executing Legal Agent');
      return await legalAgent.execute(state);
    }, { ends: ['human', 'closure', END] })  // Legal can route to human node or closure
    .addNode('closure', async (state: PropertyWorkflowStateType) => {
      console.log('[Workflow] Executing Closure Agent');
      return await closureAgent.execute(state);
    }, { ends: ['human', END] })  // Closure can route to human node or END
    // Add human node for multi-turn conversations
    .addNode('human', async (state: PropertyWorkflowStateType, config: any) => {
      console.log('[Workflow] Executing Human Node (collecting user input)');
      return await humanNode(state, config);
    }, { ends: ['lead_management', 'negotiation', 'legal', 'closure'] })  // Human can route back to any agent
    // Set entry point
    .addEdge(START, 'input_validation')
    // Add conditional edges based on stage
    .addConditionalEdges(
      'input_validation',
      (state: PropertyWorkflowStateType) => {
        // If validation passed and ready for marketing, proceed
        if (state.stage === 'marketing') {
          return 'marketing';
        }
        // Otherwise, requires human intervention to fix issues
        return END;
      },
      {
        marketing: 'marketing',
        [END]: END,
      }
    )
    .addConditionalEdges(
      'marketing',
      (state: PropertyWorkflowStateType) => {
        // Marketing always proceeds to lead management
        if (state.stage === 'lead_management') {
          return 'lead_management';
        }
        return END;
      },
      {
        lead_management: 'lead_management',
        [END]: END,
      }
    )
    .addConditionalEdges(
      'lead_management',
      (state: PropertyWorkflowStateType) => {
        // Check if lead manager signaled ready for negotiation
        const leadManagerOutput = state.agentOutputs?.lead_manager;
        if (leadManagerOutput?.data?.readyForNegotiation) {
          return 'negotiation';
        }
        // Otherwise stay in lead management (waiting for leads/offers)
        return END;
      },
      {
        negotiation: 'negotiation',
        [END]: END,
      }
    )
    // Negotiation node uses Command routing, no conditional edges needed
    // It will route to 'human', 'legal', or END based on agent decision

    // Legal node uses Command routing, no conditional edges needed
    // It will route to 'human', 'closure', or END based on agent decision

    // Closure node uses Command routing, no conditional edges needed
    // It will route to 'human' or END based on agent decision

  // Get checkpoint saver for state persistence
  const checkpointer = await getCheckpointSaver();

  // Compile the workflow with checkpointing
  const compiledWorkflow = workflow.compile({
    checkpointer,
  });

  return compiledWorkflow;
}

/**
 * Execute the workflow for a property
 */
export async function executePropertyWorkflow(initialState: PropertyWorkflowStateType) {
  console.log('[Workflow] Starting property sales workflow', {
    propertyId: initialState.propertyId,
    stage: initialState.stage,
  });

  const workflow = await createPropertySalesWorkflow();

  // Create a unique thread ID for this property's workflow
  const threadId = `property_${initialState.propertyId}`;

  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  console.log('[Workflow] Executing with thread ID:', threadId);

  // Execute the workflow
  const result = await workflow.invoke(initialState, config);

  console.log('[Workflow] Workflow execution complete', {
    propertyId: initialState.propertyId,
    finalStage: result.stage,
    humanInterventionRequired: result.humanInterventionRequired,
  });

  return result;
}

/**
 * Resume a workflow from a checkpoint with human response
 * Uses Command pattern to resume from interrupt()
 */
export async function resumePropertyWorkflow(
  propertyId: string,
  context: {
    humanResponse: string;
    humanRole?: 'broker' | 'lead';
    leadId?: string;
    leadEmail?: string;
    leadPhone?: string;
  }
) {
  console.log('[Workflow] Resuming workflow for property:', propertyId, {
    humanResponse: context.humanResponse,
    humanRole: context.humanRole,
    leadId: context.leadId,
  });

  const workflow = await createPropertySalesWorkflow();

  const threadId = `property_${propertyId}`;

  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  // Get current state from checkpoint
  const state = await workflow.getState(config);

  if (!state || !state.values) {
    throw new Error(`No checkpoint found for property ${propertyId}`);
  }

  console.log('[Workflow] Current checkpoint state:', {
    propertyId,
    stage: state.values.stage,
    next: state.next,
    interrupted: state.tasks?.some((t: any) => t.interrupts?.length > 0),
  });

  // ⚠️ IMPORTANT: Do NOT use updateState() before resuming with Command
  // Issue #3003: updateState() during interruption causes next to be empty
  // Solution: Pass context in the resume Command itself

  // Resume from interrupt using Command pattern
  // The resume value becomes the return value of interrupt() in HumanNode
  const result = await workflow.invoke(
    new Command({
      resume: context.humanResponse,  // This becomes userInput in HumanNode
      update: {
        // Pass context in the Command update instead of updateState()
        humanRole: context.humanRole || 'broker',
        currentLeadId: context.leadId,
      },
    }),
    config
  );

  console.log('[Workflow] Workflow resumed and executed', {
    propertyId,
    finalStage: result.stage,
  });

  return result;
}

/**
 * Get workflow state for a property
 * Returns both state values AND metadata (tasks, next, etc.) to detect interrupts
 */
export async function getPropertyWorkflowState(propertyId: string) {
  const workflow = await createPropertySalesWorkflow();

  const threadId = `property_${propertyId}`;

  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  const state = await workflow.getState(config);

  if (!state || !state.values) {
    return null;
  }

  // Check if workflow is interrupted (waiting for human input)
  const isInterrupted = state.tasks?.some((t: any) => t.interrupts?.length > 0) || false;

  return {
    ...state.values,
    // Add metadata about interruption state
    __interrupted: isInterrupted,
    __next: state.next,
    __tasks: state.tasks,
  };
}

/**
 * Get workflow history for a property
 */
export async function getPropertyWorkflowHistory(propertyId: string) {
  const workflow = await createPropertySalesWorkflow();

  const threadId = `property_${propertyId}`;

  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  const stateHistory = await workflow.getStateHistory(config);

  const history = [];
  for await (const state of stateHistory) {
    history.push({
      timestamp: new Date(), // Checkpoints don't have created_at by default
      stage: state.values.stage,
      agentOutputs: state.values.agentOutputs,
      humanInterventionRequired: state.values.humanInterventionRequired,
    });
  }

  return history;
}
