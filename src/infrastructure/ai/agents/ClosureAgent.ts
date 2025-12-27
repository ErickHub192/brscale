/**
 * Closure Agent
 * Manages final review, signatures, and transaction completion (human-supervised)
 */

import { BaseAgent, AgentConfig } from './BaseAgent';
import { PropertyWorkflowStateType } from '../types/WorkflowState';
import { TOOL_CATEGORIES } from '../tools/allTools';
import { AI_CONFIG } from '@/infrastructure/config/env';
import { Command, END } from '@langchain/langgraph';
import { z } from 'zod';

export class ClosureAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Closure Agent',
      description:
        'Coordinates final review, document signatures, and transaction completion with mandatory human supervision',
      tools: TOOL_CATEGORIES.CLOSURE,
      temperature: AI_CONFIG.temperature.deterministic, // 0.0 for precise coordination
      maxTokens: AI_CONFIG.maxTokens.medium, // 1500 tokens
      systemPrompt: `You are the Closure Agent for BR SCALE real estate platform.

⚠️ CRITICAL: This stage REQUIRES human intervention. You coordinate, but humans decide.

Your responsibilities:
1. **Final Document Review**: Verify all documents are complete and reviewed by attorney
2. **Signature Coordination**: Organize document signing (but humans sign, not you)
3. **Closing Checklist**: Ensure all items are completed before closing
4. **Transaction Monitoring**: Track progress through closing process
5. **Communication**: Keep all parties informed of status

Tools available:
- generate_contract: Access final contract
- send_email: Communicate with all parties

Closure Process (Human-Supervised):
1. **Pre-Closing Review** (Days 1-7)
   - Attorney reviews all documents
   - Buyer completes financing
   - Home inspection completed
   - Title search completed
   - Insurance obtained

2. **Document Preparation** (Days 8-14)
   - Final contract revisions
   - Disclosure signatures
   - Loan documents prepared
   - Closing disclosure sent to buyer

3. **Final Walkthrough** (Days 15-30)
   - Buyer final property walkthrough
   - Address any issues found
   - Confirm property condition
   - Verify repairs completed

4. **Closing Day** (Day 30-45)
   - All parties meet at title company
   - Sign final documents
   - Transfer funds
   - Exchange keys
   - Record deed

5. **Post-Closing** (After closing)
   - File deed with county
   - Transfer utilities
   - Update records
   - Archive documents

IMPORTANT - Human Checkpoints:
- ✋ Attorney must review ALL documents before proceeding
- ✋ Broker must approve final contract terms
- ✋ Human must be present at closing
- ✋ All signatures require human action
- ✋ Funds transfer requires human authorization

This agent COORDINATES but does NOT execute legal actions.`,
    };

    super(config);
  }

  async execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType> | Command> {
    this.log('Starting closure coordination (human-supervised)');

    try {
      const { property, propertyId, currentOffer, legalDocuments, humanResponse } = state;

      if (!property) {
        throw new Error('Property data not found in state');
      }

      if (!currentOffer || currentOffer.status !== 'accepted') {
        throw new Error('No accepted offer found for closure');
      }

      if (!legalDocuments || legalDocuments.status === 'draft') {
        throw new Error(
          'Legal documents not ready. All documents must be reviewed by attorney first.'
        );
      }

      // Check if human has confirmed closure completion
      if (humanResponse) {
        this.log('Processing human response on closure', { humanResponse });

        const closureStatus = this.generateClosureStatus(state);

        // Single LLM call to interpret intent AND generate response
        const interpretation = await this.interpretAndRespond(
          humanResponse,
          closureStatus,
          property,
          currentOffer
        );

        this.log('Human response interpreted', {
          decision: interpretation.decision,
          response: interpretation.response?.substring(0, 100),
          reasoning: interpretation.reasoning
        });

        const decision = interpretation.decision;

        // Strategy Pattern: Map decisions to handlers
        const decisionHandlers: Record<string, () => Promise<Partial<PropertyWorkflowStateType> | Command>> = {
          COMPLETE: async () => {
            // Return Command to mark workflow as completed
            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'completed',
              humanInterventionRequired: false,
              workflowCompletedAt: new Date(),
              agentOutputs: {
                ...state.agentOutputs,
                closure: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: { humanConfirmed: true, closureComplete: true },
                  nextAction: 'Workflow completed successfully. Property sale finalized!',
                },
              },
            };

            return new Command({
              update: updatedState,
              goto: END,
            });
          },

          PENDING: async () => {
            // Continue monitoring closure status - stay in closure stage
            return {};
          },

          DISCUSS: async () => {
            // Human asked a question or wants to discuss
            this.log('Human wants to discuss closure', {
              humanResponse,
              agentResponse: interpretation.response.substring(0, 100)
            });

            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'closure',
              messages: [
                ...(state.messages || []),
                {
                  role: 'assistant',
                  content: interpretation.response,
                  timestamp: new Date(),
                  agentName: this.config.name,
                },
              ],
              agentOutputs: {
                ...state.agentOutputs,
                closure: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    ...(state.agentOutputs?.closure?.data || {}),
                    conversationMode: true,
                    lastResponse: interpretation.response,
                  },
                  nextAction: `Responded: "${interpretation.response.substring(0, 80)}..."`,
                },
              },
            };

            return new Command({
              update: updatedState,
              goto: 'human',
            });
          },
        };

        const handler = decisionHandlers[decision];
        if (handler) {
          const result = await handler();
          if (Object.keys(result).length > 0 || result instanceof Command) {
            return result;
          }
        }
      }

      this.log('Coordinating closure process', {
        offerId: currentOffer.id,
        propertyId,
      });

      // Generate closure checklist status
      const closureStatus = this.generateClosureStatus(state);

      // Send status update to all parties
      await this.sendClosureStatusUpdate(property, currentOffer, closureStatus);

      // Determine next action based on status
      const nextAction = this.determineNextAction(closureStatus);
      const allTasksComplete = closureStatus.readyForClosing && closureStatus.allChecklistItemsComplete;

      this.log('Closure status determined', {
        readyForClosing: closureStatus.readyForClosing,
        pendingItems: closureStatus.pendingItems.length,
        nextAction,
      });

      // If all pre-closing tasks are complete, wait for human confirmation
      if (allTasksComplete) {
        // Update state BEFORE interrupt
        const updatedState: Partial<PropertyWorkflowStateType> = {
          stage: 'closure', // Stay in closure until human confirms completion
          agentOutputs: {
            ...state.agentOutputs,
            closure: {
              agentName: this.config.name,
              timestamp: new Date(),
              success: true,
              data: {
                closureStatus,
                readyForClosing: true,
                allTasksComplete: true,
                pendingItems: closureStatus.pendingItems,
                completedItems: closureStatus.completedItems,
                nextAction,
              },
              nextAction: `✋ CLOSURE CONFIRMATION REQUIRED: All pre-closing tasks verified.

Completed Tasks:
${closureStatus.completedItems.map(item => `✅ ${item}`).join('\n')}

⚠️ BROKER MUST CONFIRM:
- All parties have signed the contract
- Funds have been transferred
- Keys have been exchanged
- Transaction is physically complete

Please type your decision:
- "complete" or "transaction complete" → Mark workflow as COMPLETED
- "pending" or "wait" → More tasks needed before closing

🎯 This is the final step. Once confirmed, the transaction will be marked as CLOSED.`,
            },
          },
        };

        // ⏸️ ROUTE TO HUMAN NODE: Let human node handle the interrupt
        return new Command({
          update: updatedState,
          goto: 'human', // Route to human node for input
        });
      }

      // Not ready for closing - return status without interrupt
      return {
        stage: 'closure',
        agentOutputs: {
          ...state.agentOutputs,
          closure: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: true,
            data: {
              closureStatus,
              readyForClosing: false,
              pendingItems: closureStatus.pendingItems,
              completedItems: closureStatus.completedItems,
              nextAction,
            },
            nextAction: `⏳ PENDING CLOSURE TASKS:

Pending:
${closureStatus.pendingItems.map(item => `⏳ ${item}`).join('\n')}

Completed:
${closureStatus.completedItems.map(item => `✅ ${item}`).join('\n')}

Next Action: ${nextAction}`,
          },
        },
      };
    } catch (error) {
      this.logError('Closure coordination failed', error);

      return {
        stage: 'closure',
        humanInterventionRequired: true,
        agentOutputs: {
          ...state.agentOutputs,
          closure: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: false,
            data: null,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        },
        errors: [...(state.errors || []), `Closure Agent failed: ${error}`],
      };
    }
  }

  /**
   * Generate closure checklist status
   */
  private generateClosureStatus(state: PropertyWorkflowStateType): {
    readyForClosing: boolean;
    allChecklistItemsComplete: boolean;
    completedItems: string[];
    pendingItems: string[];
    blockers: string[];
  } {
    const completedItems: string[] = [];
    const pendingItems: string[] = [];
    const blockers: string[] = [];

    // Check critical requirements
    const criticalChecks = [
      {
        name: 'Attorney document review',
        completed: state.legalDocuments?.status === 'review',
        blocker: true,
      },
      {
        name: 'Purchase contract signed',
        completed: false, // TODO: Track signature status
        blocker: true,
      },
      {
        name: 'Buyer financing approved',
        completed: false, // TODO: Track financing status
        blocker: true,
      },
      {
        name: 'Home inspection completed',
        completed: false,
        blocker: false,
      },
      {
        name: 'Title search completed',
        completed: false,
        blocker: true,
      },
      {
        name: 'Homeowners insurance obtained',
        completed: false,
        blocker: true,
      },
      {
        name: 'Final walkthrough completed',
        completed: false,
        blocker: false,
      },
      {
        name: 'Closing date scheduled',
        completed: true, // From offer
        blocker: false,
      },
    ];

    criticalChecks.forEach((check) => {
      if (check.completed) {
        completedItems.push(check.name);
      } else {
        pendingItems.push(check.name);
        if (check.blocker) {
          blockers.push(check.name);
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

  /**
   * Send closure status update to all parties
   */
  private async sendClosureStatusUpdate(
    property: any,
    offer: any,
    status: any
  ): Promise<void> {
    const emailTool = this.config.tools.find((t) => t.name === 'send_email');
    if (!emailTool) return;

    const message = `Subject: Transaction Status Update - ${property.address.city} Property

Dear All,

Here's the current status of the transaction for ${property.address.street}, ${property.address.city}, ${property.address.state}.

Purchase Price: $${offer.amount.toLocaleString()}
Scheduled Closing Date: ${new Date(offer.expiresAt).toLocaleDateString()}

✅ Completed Items:
${status.completedItems.map((item: string) => `- ${item}`).join('\n')}

⏳ Pending Items:
${status.pendingItems.map((item: string) => `- ${item}`).join('\n')}

${status.blockers.length > 0 ? `\n⚠️ Critical Items Blocking Closing:\n${status.blockers.map((item: string) => `- ${item}`).join('\n')}` : ''}

${status.readyForClosing ? '\n🎉 All critical items complete! Ready to proceed to closing.' : '\n📋 Please address pending items to keep the transaction on track.'}

We'll send daily updates as we progress toward closing.

Best regards,
BR SCALE Real Estate Team`;

    await emailTool.func({
      to: 'all-parties@example.com', // TODO: Send to all parties
      subject: `Transaction Status Update - ${property.address.city} Property`,
      body: message,
      propertyId: property.id,
    });

    this.log('Closure status update sent');
  }

  /**
   * Determine next action based on closure status
   */
  private determineNextAction(status: any): string {
    if (status.blockers.length > 0) {
      return `Complete critical items: ${status.blockers.slice(0, 2).join(', ')}`;
    }

    if (status.pendingItems.length > 0) {
      return `Complete pending items: ${status.pendingItems.slice(0, 2).join(', ')}`;
    }

    if (status.readyForClosing && !status.allChecklistItemsComplete) {
      return 'Schedule closing meeting with all parties';
    }

    if (status.allChecklistItemsComplete) {
      return 'Proceed to closing and document signing';
    }

    return 'Monitor transaction progress';
  }

  /**
   * Single LLM call to interpret human intent AND generate response
   * More efficient than separate calls for interpretation + response generation
   */
  private async interpretAndRespond(
    humanMessage: string,
    closureStatus: any,
    property: any,
    offer: any
  ): Promise<{ decision: string; response: string; reasoning?: string }> {
    // Define structured output schema
    const ResponseSchema = z.object({
      decision: z.enum(['COMPLETE', 'PENDING', 'DISCUSS']).describe(
        'COMPLETE = broker confirms transaction is complete (all signed, funds transferred), PENDING = more tasks needed, DISCUSS = broker has questions'
      ),
      response: z.string().describe(
        'Your response to the broker. If DISCUSS, answer their question. If COMPLETE/PENDING, acknowledge their decision.'
      ),
      reasoning: z.string().optional().describe('Brief explanation of your interpretation'),
    });

    const llmWithStructuredOutput = this.model.withStructuredOutput(ResponseSchema);

    const prompt = `You are a professional real estate closure agent. Analyze the broker's message and determine their intent, then generate an appropriate response.

CONTEXT:
- Property: ${property.bedrooms} bed / ${property.bathrooms} bath ${property.propertyType}
- Location: ${property.address.city}, ${property.address.state}
- Purchase Price: $${offer.amount.toLocaleString()}
- Closure Status: ${closureStatus.readyForClosing ? 'Ready for closing' : 'Pending tasks'}
- Completed Items: ${closureStatus.completedItems.length}
- Pending Items: ${closureStatus.pendingItems.length}

BROKER'S MESSAGE: "${humanMessage}"

TASK:
1. Determine their intent:
   - COMPLETE: They confirm closing is done (phrases like "complete", "done", "finalized", "transaction complete", "funds transferred")
   - PENDING: They indicate more work needed (phrases like "pending", "wait", "not yet", "still working on")
   - DISCUSS: They have questions or want to discuss (phrases like "why", "explain", "what about", "status")

2. Generate a professional response:
   - If DISCUSS: Answer their question about the closure process (2-3 sentences)
   - If COMPLETE/PENDING: Acknowledge and confirm what you'll do next

Be helpful, professional, and maintain a collaborative tone.`;

    const result = await llmWithStructuredOutput.invoke(prompt);
    return result as { decision: string; response: string; reasoning?: string };
  }
}
