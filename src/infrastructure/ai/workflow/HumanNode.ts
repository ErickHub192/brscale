/**
 * Human Node
 * Handles multi-turn conversations between human and agents
 * Uses interrupt() to pause and collect user input
 */

import { interrupt, Command } from '@langchain/langgraph';
import { PropertyWorkflowStateType, PropertyWorkflowState } from '../types/WorkflowState';

/**
 * Human Node - Collects user input and routes back to active agent
 * Enables multi-turn conversations for debate/discussion before final decisions
 */
export async function humanNode(
  state: PropertyWorkflowStateType,
  config: any
): Promise<Command> {
  console.log('[HumanNode] Waiting for user input');

  // Get the last active agent from state.stage (most reliable)
  // Fallback to langgraph triggers if needed
  let activeAgent = state.stage || 'negotiation';

  const langgraphTriggers = config?.configurable?.langgraph_triggers || [];
  if (langgraphTriggers.length > 0) {
    // Extract agent name from trigger (format: "branch:agent_name:path")
    const triggerParts = langgraphTriggers[0].split(':');
    if (triggerParts.length > 1) {
      activeAgent = triggerParts[1];
    }
  }

  console.log('[HumanNode] Active agent:', activeAgent);

  // Determine the context message based on active agent and who is talking
  const humanRole = state.humanRole || 'broker';
  const currentLeadId = state.currentLeadId;

  let contextMessage = `💬 Conversing with ${activeAgent} agent.`;

  if (activeAgent === 'lead_management' && humanRole === 'lead') {
    // Lead talking to LeadManager
    const leadConversation = state.leadConversations?.[currentLeadId || ''];
    const agentLastMessage = leadConversation?.messages?.[leadConversation.messages.length - 1];

    contextMessage = `💬 Property Inquiry Conversation

${agentLastMessage?.role === 'assistant' ? `Agent: ${agentLastMessage.content}\n\n` : ''}What would you like to know about this property?

Type your message:`;
  } else if (activeAgent === 'lead_management' && humanRole === 'broker') {
    // Broker managing leads
    contextMessage = `💬 Lead Management Dashboard

You can:
- Review lead conversations and qualification scores
- Manually advance to negotiation if ready
- Ask about lead status and metrics

Type your message:`;
  } else {
    // Other agents (negotiation, legal, closure)
    contextMessage = `💬 Broker Dashboard - ${activeAgent} agent

You can:
- Ask questions or debate the recommendation
- Request modifications
- Make a final decision (approve/reject/etc.)

Type your message:`;
  }

  // Collect user input via interrupt
  const userInput = interrupt({ value: contextMessage });

  console.log('[HumanNode] User input received:', {
    userInput,
    humanRole,
    currentLeadId,
  });

  // Route back to the active agent with the message
  // humanRole and currentLeadId are already in state (set by API or previous interaction)
  return new Command({
    update: {
      humanResponse: userInput,
      // Add message to conversation history
      messages: [
        ...(state.messages || []),
        {
          role: 'human',
          content: userInput,
          timestamp: new Date(),
        },
      ],
    },
    goto: activeAgent, // Return to the agent that was active
  });
}

/**
 * Determine if agent should continue conversation or advance workflow
 * This is called by agents after processing humanResponse
 */
export function shouldContinueConversation(
  humanResponse: string,
  agentDecision: 'APPROVE' | 'REJECT' | 'MODIFY' | 'DISCUSS'
): boolean {
  // If decision is DISCUSS, continue the conversation loop
  // Otherwise, it's a final decision and workflow should advance
  return agentDecision === 'DISCUSS';
}

/**
 * Create agent response for multi-turn conversation
 * Used when agent wants to provide information without advancing workflow
 */
export function createConversationResponse(
  agentName: string,
  response: string,
  state: PropertyWorkflowStateType
): Partial<PropertyWorkflowStateType> {
  return {
    messages: [
      ...(state.messages || []),
      {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        agentName,
      },
    ],
    agentOutputs: {
      ...state.agentOutputs,
      [agentName.toLowerCase().replace(' ', '_')]: {
        agentName,
        timestamp: new Date(),
        success: true,
        data: {
          conversationMode: true,
          response,
        },
        nextAction: `Agent responded: ${response.substring(0, 100)}...`,
      },
    },
  };
}
