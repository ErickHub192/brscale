/**
 * Legal Agent
 * Prepares contracts, disclosures, and manages legal documentation
 */

import { BaseAgent, AgentConfig } from './BaseAgent';
import { PropertyWorkflowStateType, LegalDocuments } from '../types/WorkflowState';
import { TOOL_CATEGORIES } from '../tools/allTools';
import { AI_CONFIG } from '@/infrastructure/config/env';
import { Command } from '@langchain/langgraph';
import { z } from 'zod';

export class LegalAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Legal Agent',
      description:
        'Prepares purchase contracts, disclosure documents, inspection checklists, and closing documentation',
      tools: TOOL_CATEGORIES.LEGAL,
      temperature: AI_CONFIG.temperature.deterministic, // 0.0 for precise legal documents
      maxTokens: AI_CONFIG.maxTokens.long, // 4000 tokens for documents
      systemPrompt: `You are the Legal Agent for BR SCALE real estate platform.

Your responsibilities:
1. **Generate Purchase Contracts**: Create legally compliant purchase agreements
2. **Prepare Disclosures**: Generate all required disclosure documents
3. **Create Checklists**: Inspection and closing checklists
4. **Document Management**: Organize and track all legal documents
5. **Compliance**: Ensure all documents meet state/local requirements

Tools available:
- generate_contract: Create purchase contract from template
- generate_disclosure: Create disclosure documents
- generate_inspection_checklist: Create inspection checklist
- generate_closing_checklist: Create closing checklist

Document Types:
1. **Purchase Contract**: Legally binding agreement between buyer and seller
   - Property details and description
   - Purchase price and payment terms
   - Closing date and conditions
   - Contingencies and deadlines
   - Signatures and notarization requirements

2. **Disclosures**: Required property condition disclosures
   - Lead paint disclosure (pre-1978 properties)
   - Structural issues
   - Environmental hazards
   - Mold or water damage
   - Neighborhood/community disclosures

3. **Inspection Checklist**: Comprehensive property inspection guide
   - Foundation and structural
   - Roof and exterior
   - Plumbing and water systems
   - Electrical systems
   - HVAC systems
   - Interior conditions
   - Appliances

4. **Closing Checklist**: Transaction closing requirements
   - Document preparation timeline
   - Buyer requirements (ID, insurance, funds)
   - Seller requirements (title, disclosures, keys)
   - Third-party requirements (lender, title company)
   - Post-closing steps

IMPORTANT:
- All documents are DRAFTS requiring human legal review
- Never claim documents are legally binding without attorney review
- Flag any unusual conditions for human attention
- Maintain compliance with state/federal regulations
- Preserve all document versions for audit trail`,
    };

    super(config);
  }

  async execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType> | Command> {
    this.log('Starting legal document preparation');

    try {
      const { property, propertyId, currentOffer, humanResponse, legalDocuments: existingDocs } = state;

      if (!property) {
        throw new Error('Property data not found in state');
      }

      if (!currentOffer) {
        throw new Error('No accepted offer found - cannot prepare legal documents');
      }

      if (currentOffer.status !== 'accepted') {
        throw new Error('Offer must be accepted before preparing legal documents');
      }

      // Check if human has reviewed the legal documents
      if (humanResponse && existingDocs && existingDocs.status === 'review') {
        this.log('Processing human response on legal documents', { humanResponse });

        const docCount = (existingDocs.disclosures?.length || 0) +
                        (existingDocs.inspectionChecklist?.length || 0) +
                        (existingDocs.closingChecklist?.length || 0) +
                        (existingDocs.contractTemplate ? 1 : 0);

        // Single LLM call to interpret intent AND generate response
        const interpretation = await this.interpretAndRespond(
          humanResponse,
          existingDocs,
          property,
          currentOffer,
          docCount
        );

        this.log('Human response interpreted', {
          decision: interpretation.decision,
          response: interpretation.response?.substring(0, 100),
          reasoning: interpretation.reasoning
        });

        const decision = interpretation.decision;

        // Strategy Pattern: Map decisions to handlers
        const decisionHandlers: Record<string, () => Promise<Partial<PropertyWorkflowStateType> | Command>> = {
          APPROVE: async () => {
            // Return Command to advance to Closure stage
            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'closure',
              agentOutputs: {
                ...state.agentOutputs,
                legal: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: { humanApproved: true, documentsApproved: docCount },
                  nextAction: 'Legal documents approved. Proceeding to Closure Agent.',
                },
              },
            };

            return new Command({
              update: updatedState,
              goto: 'closure',
            });
          },

          REVISE: async () => {
            const modifications = await this.extractModificationInstructions(
              humanResponse,
              state.agentOutputs?.legal?.data || {}
            );
            this.log('Human requested document revisions', modifications);

            // Regenerate documents with modifications
            // (For now, fall through to regenerate - in production, apply modifications)
            return {};
          },

          DISCUSS: async () => {
            // Human asked a question or wants to discuss
            this.log('Human wants to discuss legal documents', {
              humanResponse,
              agentResponse: interpretation.response.substring(0, 100)
            });

            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'legal',
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
                legal: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    ...(state.agentOutputs?.legal?.data || {}),
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
          if (Object.keys(result).length > 0) {
            return result;
          }
        }
      }

      this.log('Preparing legal documents for accepted offer', {
        offerId: currentOffer.id,
        amount: currentOffer.amount,
      });

      // Step 1: Generate purchase contract
      this.log('Generating purchase contract');
      const contractTool = this.config.tools.find((t) => t.name === 'generate_contract');
      if (!contractTool) {
        throw new Error('generate_contract tool not found');
      }

      const contractResult = await contractTool.func({
        propertyId,
        propertyData: {
          address: `${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zipCode}`,
          price: currentOffer.amount,
          sellerName: 'John Seller', // TODO: Get actual seller name
        },
        offerData: {
          buyerName: 'Jane Buyer', // TODO: Get actual buyer name from lead
          buyerEmail: 'buyer@example.com',
          offerAmount: currentOffer.amount,
          conditions: currentOffer.conditions,
          closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days
        },
        templateType: 'standard',
      });

      const contract = JSON.parse(contractResult);

      // Step 2: Generate disclosure documents
      this.log('Generating disclosure documents');
      const disclosureTool = this.config.tools.find((t) => t.name === 'generate_disclosure');
      if (!disclosureTool) {
        throw new Error('generate_disclosure tool not found');
      }

      const disclosures: string[] = [];

      // Lead paint disclosure (if property built before 1978)
      const yearBuilt = 1985; // TODO: Get actual year built from property data
      if (yearBuilt < 1978) {
        const leadPaintResult = await disclosureTool.func({
          propertyId,
          propertyData: {
            address: `${property.address.street}, ${property.address.city}, ${property.address.state}`,
            yearBuilt,
            propertyType: property.propertyType,
          },
          disclosureType: 'lead_paint',
          knownIssues: [],
        });
        const leadPaint = JSON.parse(leadPaintResult);
        disclosures.push(leadPaint.documentUrl);
      }

      // Full disclosure
      const fullDisclosureResult = await disclosureTool.func({
        propertyId,
        propertyData: {
          address: `${property.address.street}, ${property.address.city}, ${property.address.state}`,
          yearBuilt,
          propertyType: property.propertyType,
        },
        disclosureType: 'full',
        knownIssues: [], // TODO: Get known issues from property data
      });
      const fullDisclosure = JSON.parse(fullDisclosureResult);
      disclosures.push(fullDisclosure.documentUrl);

      // Step 3: Generate inspection checklist
      this.log('Generating inspection checklist');
      const inspectionTool = this.config.tools.find(
        (t) => t.name === 'generate_inspection_checklist'
      );
      if (!inspectionTool) {
        throw new Error('generate_inspection_checklist tool not found');
      }

      const inspectionResult = await inspectionTool.func({
        propertyId,
        propertyType: property.propertyType,
        includeAreas: [
          'foundation',
          'roof',
          'plumbing',
          'electrical',
          'hvac',
          'interior',
          'exterior',
          'appliances',
        ],
      });
      const inspectionChecklist = JSON.parse(inspectionResult);

      // Step 4: Generate closing checklist
      this.log('Generating closing checklist');
      const closingTool = this.config.tools.find((t) => t.name === 'generate_closing_checklist');
      if (!closingTool) {
        throw new Error('generate_closing_checklist tool not found');
      }

      const closingResult = await closingTool.func({
        propertyId,
        transactionData: {
          buyerName: 'Jane Buyer',
          sellerName: 'John Seller',
          closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          purchasePrice: currentOffer.amount,
        },
      });
      const closingChecklist = JSON.parse(closingResult);

      // Step 5: Create legal documents object
      const legalDocuments: LegalDocuments = {
        contractTemplate: contract.documentUrl,
        disclosures,
        inspectionChecklist: [inspectionChecklist.documentUrl],
        closingChecklist: [closingChecklist.documentUrl],
        status: 'draft',
      };

      this.log('Legal documents prepared', {
        contract: contract.documentId,
        disclosures: disclosures.length,
        status: 'draft',
      });

      // Update state BEFORE interrupt
      const updatedState: Partial<PropertyWorkflowStateType> = {
        stage: 'legal', // Stay in legal until approved
        legalDocuments: {
          ...legalDocuments,
          status: 'review', // Mark as under review
        },
        agentOutputs: {
          ...state.agentOutputs,
          legal: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: true,
            data: {
              contractGenerated: true,
              contractUrl: contract.documentUrl,
              disclosuresGenerated: disclosures.length,
              inspectionChecklistGenerated: true,
              closingChecklistGenerated: true,
              status: 'review',
              requiresReview: true,
            },
            nextAction: `⚖️ ATTORNEY REVIEW REQUIRED: Legal documents prepared and ready for review.

Documents Generated:
- Purchase Contract: ${contract.documentUrl}
- Disclosure Documents: ${disclosures.length} files
- Inspection Checklist: ${inspectionChecklist.documentUrl}
- Closing Checklist: ${closingChecklist.documentUrl}

⚠️ IMPORTANT: All documents are DRAFTS and MUST be reviewed by a licensed attorney before signing.

Please type your decision:
- "approve" or "aprobar documentos" → Proceed to closure
- "revise [instructions]" → Request document modifications

⚖️ Legal Protection: Attorney review required for all real estate contracts.`,
          },
        },
      };

      // ⏸️ ROUTE TO HUMAN NODE: Let human node handle the interrupt
      return new Command({
        update: updatedState,
        goto: 'human', // Route to human node for input
      });
    } catch (error) {
      this.logError('Legal document preparation failed', error);

      return {
        stage: 'legal',
        humanInterventionRequired: true,
        agentOutputs: {
          ...state.agentOutputs,
          legal: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: false,
            data: null,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        },
        errors: [...(state.errors || []), `Legal Agent failed: ${error}`],
      };
    }
  }

  /**
   * Single LLM call to interpret human intent AND generate response
   * More efficient than separate calls for interpretation + response generation
   */
  private async interpretAndRespond(
    humanMessage: string,
    legalDocs: LegalDocuments,
    property: any,
    offer: any,
    docCount: number
  ): Promise<{ decision: string; response: string; reasoning?: string }> {
    // Define structured output schema
    const ResponseSchema = z.object({
      decision: z.enum(['APPROVE', 'REVISE', 'DISCUSS']).describe(
        'APPROVE = broker approves documents, REVISE = broker wants changes, DISCUSS = broker has questions'
      ),
      response: z.string().describe(
        'Your response to the broker. If DISCUSS, answer their question. If APPROVE/REVISE, acknowledge their decision.'
      ),
      reasoning: z.union([z.string(), z.null()]).describe('Brief explanation of your interpretation'),
    });

    const llmWithStructuredOutput = this.model.withStructuredOutput(ResponseSchema);

    const prompt = `You are a professional real estate legal agent. Analyze the broker's message and determine their intent, then generate an appropriate response.

CONTEXT:
- Property: ${property.bedrooms} bed / ${property.bathrooms} bath ${property.propertyType}
- Location: ${property.address.city}, ${property.address.state}
- Purchase Price: $${offer.amount.toLocaleString()}
- Legal Documents Prepared: ${docCount} documents (contract, disclosures, checklists)
- Document Status: Ready for review

BROKER'S MESSAGE: "${humanMessage}"

TASK:
1. Determine their intent:
   - APPROVE: They want to approve the documents (phrases like "approve", "looks good", "proceed", "acepta")
   - REVISE: They want changes to documents (phrases like "revise", "change", "modify", "update")
   - DISCUSS: They have questions or want to discuss (phrases like "why", "explain", "tell me more", "what about")

2. Generate a professional response:
   - If DISCUSS: Answer their question about the legal documents (2-3 sentences)
   - If APPROVE/REVISE: Acknowledge and confirm what you'll do next

Be helpful, professional, and maintain a collaborative tone.`;

    const result = await llmWithStructuredOutput.invoke(prompt);
    return result as { decision: string; response: string; reasoning?: string };
  }
}
