/**
 * Negotiation Agent
 * Analyzes offers, suggests counter-offers, and manages negotiation strategy
 */

import { BaseAgent, AgentConfig } from './BaseAgent';
import { PropertyWorkflowStateType, Offer } from '../types/WorkflowState';
import { TOOL_CATEGORIES } from '../tools/allTools';
import { AI_CONFIG } from '@/infrastructure/config/env';
import { Command } from '@langchain/langgraph';
import { z } from 'zod';

export class NegotiationAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Negotiation Agent',
      description:
        'Analyzes purchase offers, suggests counter-offer strategies, and manages negotiation communications',
      tools: TOOL_CATEGORIES.NEGOTIATION,
      temperature: AI_CONFIG.temperature.precise, // 0.3 for strategic decisions
      maxTokens: AI_CONFIG.maxTokens.medium, // 1500 tokens
      systemPrompt: `You are the Negotiation Agent for BR SCALE real estate platform.

Your responsibilities:
1. **Analyze Offers**: Evaluate every offer against asking price, market data, and conditions
2. **Strategic Recommendations**: Suggest accept, counter-offer, or reject based on multiple factors
3. **Counter-Offer Strategy**: Calculate optimal counter-offer amounts
4. **Risk Assessment**: Evaluate contingencies and closing risks
5. **Communication**: Draft professional, strategic responses to buyers

⚖️ **LEGAL COMPLIANCE & HUMAN-IN-THE-LOOP**:
- ✅ ANALYZE & RECOMMEND: Always provide data-driven analysis
- ⏸️ PAUSE for ACCEPT: NEVER auto-accept offers (requires broker approval per licensing laws)
- ✅ AUTO-EXECUTE COUNTER-OFFERS: Safe to send automatically (not a binding commitment)
- ✅ AUTO-REJECT LOW-BALLS: Offers <75% asking can be rejected automatically
- ⏸️ PAUSE for DECENT REJECTIONS: Offers >75% require broker confirmation before rejecting

Tools available:
- analyze_offer: Deep analysis of offer strength and recommendations
- fetch_market_data: Current market conditions for context
- send_whatsapp_message: Communicate with buyers/agents
- send_email: Send formal offer responses

Offer Analysis Factors:
- Offer percentage vs asking price (>95% = strong, <85% = weak)
- Market conditions (hot/stable/cooling)
- Days on market (>60 = more flexible)
- Contingencies (inspection, financing, appraisal)
- Earnest money deposit (higher = more serious)
- Closing timeline
- Buyer pre-approval status

Recommendation Guidelines:
- **ACCEPT**: Offer >= 95% of asking, favorable conditions, hot market
  → REQUIRES BROKER APPROVAL (legal liability protection)
- **COUNTER-OFFER**: Offer 85-95%, reasonable conditions, room for negotiation
  → AUTO-EXECUTES (safe, not a binding commitment)
- **REJECT (<75% asking)**: Low-ball offers, insulting terms
  → AUTO-EXECUTES (safe, protects seller's interests)
- **REJECT (>75% asking)**: Decent offers with issues
  → REQUIRES BROKER CONFIRMATION (avoid missed opportunities)

Counter-Offer Strategy:
- Hot market: Counter at 97-99% of asking
- Stable market: Counter at 94-97% of asking
- Cooling market: Counter at 90-94% of asking
- Multiple offers: Hold firm or slight counter

Communication Principles:
- Professional and respectful tone
- Data-driven justifications
- Create urgency without pressure
- Maintain negotiating leverage
- Preserve relationship for future deals
- Always draft messages for broker review when required`,
    };

    super(config);
  }

  async execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType> | Command> {
    this.log('Starting offer analysis and negotiation');

    try {
      const { property, propertyId, currentOffer, offerHistory = [], humanResponse } = state;

      if (!property) {
        throw new Error('Property data not found in state');
      }

      // Check if we're resuming from an interrupt (humanResponse will be set by Command resume)
      if (humanResponse && currentOffer) {
        this.log('Processing human response', { humanResponse });

        // Single LLM call to interpret intent AND generate response
        const analysis = state.agentOutputs?.negotiation?.data || {};
        const interpretation = await this.interpretAndRespond(
          humanResponse,
          currentOffer,
          property,
          analysis
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
            // Return Command to advance to Legal stage
            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'legal',
              currentOffer: { ...currentOffer, status: 'accepted' },
              agentOutputs: {
                ...state.agentOutputs,
                negotiation: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: { humanApproved: true, decision, finalStatus: 'accepted' },
                  nextAction: 'Proceeding to Legal Agent for contract preparation (human approved)',
                },
              },
            };

            return new Command({
              update: updatedState,
              goto: 'legal',
            });
          },

          REJECT: async () => ({
            stage: 'negotiation',
            humanInterventionRequired: false,
            currentOffer: { ...currentOffer, status: 'rejected' },
            offerHistory: [...offerHistory, { ...currentOffer, status: 'rejected' }],
            agentOutputs: {
              ...state.agentOutputs,
              negotiation: {
                agentName: this.config.name,
                timestamp: new Date(),
                success: true,
                data: { humanRejected: true, decision, finalStatus: 'rejected' },
                nextAction: 'Offer rejected per broker decision. Waiting for new offers.',
              },
            },
          }),

          MODIFY: async () => {
            const modifications = await this.extractModificationInstructions(
              humanResponse,
              state.agentOutputs?.negotiation?.data || {}
            );
            this.log('Human requested modifications', modifications);

            // Re-analyze offer (modifications will be logged for human context)
            const modifiedAnalysis = await this.analyzeOffer(currentOffer, property, state);

            return {
              stage: 'negotiation',
              humanInterventionRequired: true,
              currentOffer: { ...currentOffer, status: 'pending' },
              agentOutputs: {
                ...state.agentOutputs,
                negotiation: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: { ...modifiedAnalysis, humanModifications: modifications, reanalyzed: true },
                  nextAction: `Re-analyzed offer based on your feedback: ${modifications.modifications}. Please review updated recommendation.`,
                },
              },
            };
          },

          DISCUSS: async () => {
            // Human asked a question or wants to discuss
            // Response already generated by interpretAndRespond()
            this.log('Human wants to discuss/ask questions', {
              humanResponse,
              agentResponse: interpretation.response.substring(0, 100)
            });

            // Update state with conversation and return Command to go back to human
            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'negotiation',
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
                negotiation: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    ...(state.agentOutputs?.negotiation?.data || {}),
                    conversationMode: true,
                    lastResponse: interpretation.response,
                    lastInterpretation: interpretation,
                  },
                  nextAction: `Responded to broker: "${interpretation.response.substring(0, 80)}..."`,
                },
              },
            };

            // Return Command to go back to human node for continued conversation
            return new Command({
              update: updatedState,
              goto: 'human',
            });
          },
        };

        const handler = decisionHandlers[decision];
        if (handler) {
          return await handler();
        }
      }

      // Check if we have an offer to analyze
      if (!currentOffer) {
        this.log('No current offer to analyze, simulating incoming offer');
        const simulatedOffer = this.simulateIncomingOffer(propertyId, property.price);

        // Analyze the simulated offer
        const analysis = await this.analyzeOffer(simulatedOffer, property, state);

        this.log('Simulated offer analysis complete', {
          offerId: simulatedOffer.id,
          recommendation: analysis.recommendation,
          offerPercentage: analysis.offerPercentage,
        });

        // If recommendation is ACCEPT, route to human for approval
        if (analysis.recommendation === 'accept') {
          const draftMessage = this.draftAcceptanceMessage(simulatedOffer, property);

          const updatedState: Partial<PropertyWorkflowStateType> = {
            stage: 'negotiation',
            currentOffer: {
              ...simulatedOffer,
              status: 'pending',
            },
            offerHistory: [...offerHistory, simulatedOffer],
            agentOutputs: {
              ...state.agentOutputs,
              negotiation: {
                agentName: this.config.name,
                timestamp: new Date(),
                success: true,
                data: {
                  ...analysis,
                  recommendation: 'accept',
                  requiresBrokerApproval: true,
                  draftAcceptanceMessage: draftMessage,
                  legalNotice: 'BROKER APPROVAL REQUIRED: AI cannot accept offers automatically.',
                },
                nextAction: `🚨 BROKER APPROVAL REQUIRED: Agent recommends ACCEPTING this offer.

Offer: $${simulatedOffer.amount.toLocaleString()} (${analysis.offerPercentage}% of asking)
Recommendation: ${analysis.recommendation.toUpperCase()}
Reasoning: ${analysis.reasoning}

Please review and type:
- "approve" or "acepta la oferta" → Proceed to legal stage
- "modify [instructions]" → Adjust terms
- "reject" → Decline offer`,
              },
            },
          };

          // ⏸️ ROUTE TO HUMAN NODE
          return new Command({
            update: updatedState,
            goto: 'human',
          });
        }

        // For REJECT recommendations
        if (analysis.recommendation === 'reject') {
          const offerPercentage = (simulatedOffer.amount / property.price) * 100;

          if (offerPercentage >= 75) {
            // ⚠️ REJECT >=75% requires broker confirmation
            const draftMessage = this.draftRejectionMessage(simulatedOffer, property, analysis);

            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'negotiation',
              currentOffer: {
                ...simulatedOffer,
                status: 'pending',
              },
              offerHistory: [...offerHistory, simulatedOffer],
              agentOutputs: {
                ...state.agentOutputs,
                negotiation: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    ...analysis,
                    recommendation: 'reject',
                    requiresBrokerConfirmation: true,
                    draftRejectionMessage: draftMessage,
                  },
                  nextAction: `⚠️ BROKER CONFIRMATION REQUIRED: Agent recommends REJECTING.

Offer: $${simulatedOffer.amount.toLocaleString()} (${offerPercentage.toFixed(1)}% of asking)
Recommendation: REJECT
Reasoning: ${analysis.reasoning}

Please type:
- "confirm" or "reject" → Send rejection
- "counter" → Send counter-offer instead
- "accept" → Override AI and accept offer`,
                },
              },
            };

            // ⏸️ ROUTE TO HUMAN NODE
            return new Command({
              update: updatedState,
              goto: 'human',
            });
          } else {
            // ✅ Low-ball offers (<75%) auto-reject
            return {
              stage: 'negotiation',
              currentOffer: {
                ...simulatedOffer,
                status: 'rejected',
              },
              offerHistory: [...offerHistory, { ...simulatedOffer, status: 'rejected' }],
              humanInterventionRequired: false,
              agentOutputs: {
                ...state.agentOutputs,
                negotiation: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    ...analysis,
                    autoExecuted: true,
                  },
                  nextAction: `✅ Low-ball offer rejected automatically (<75%).`,
                },
              },
            };
          }
        }

        // For COUNTER_OFFER or other recommendations
        return {
          stage: 'negotiation',
          currentOffer: simulatedOffer,
          offerHistory: [...offerHistory, simulatedOffer],
          humanInterventionRequired: true,
          agentOutputs: {
            ...state.agentOutputs,
            negotiation: {
              agentName: this.config.name,
              timestamp: new Date(),
              success: true,
              data: analysis,
              nextAction: `Offer received: $${simulatedOffer.amount.toLocaleString()} (${analysis.offerPercentage}% of asking). Recommendation: ${analysis.recommendation.toUpperCase()}. Awaiting broker decision.`,
            },
          },
        };
      }

      // Analyze existing offer
      const analysis = await this.analyzeOffer(currentOffer, property, state);

      this.log('Offer analysis complete', {
        offerId: currentOffer.id,
        recommendation: analysis.recommendation,
        offerPercentage: analysis.offerPercentage,
      });

      // Take action based on recommendation
      if (analysis.recommendation === 'accept') {
        // ⚠️ ACCEPTING OFFERS REQUIRES BROKER APPROVAL (Legal liability protection)
        this.log('Recommendation: ACCEPT offer - Requires broker approval');

        // Draft acceptance message (don't send yet)
        const draftMessage = this.draftAcceptanceMessage(currentOffer, property);

        // Update state BEFORE interrupt
        const updatedState: Partial<PropertyWorkflowStateType> = {
          stage: 'negotiation',
          currentOffer: {
            ...currentOffer,
            status: 'pending',
          },
          offerHistory: [...offerHistory, currentOffer],
          agentOutputs: {
            ...state.agentOutputs,
            negotiation: {
              agentName: this.config.name,
              timestamp: new Date(),
              success: true,
              data: {
                ...analysis,
                recommendation: 'accept',
                requiresBrokerApproval: true,
                draftAcceptanceMessage: draftMessage,
                legalNotice: 'BROKER APPROVAL REQUIRED: AI cannot accept offers automatically due to licensing requirements and liability concerns.',
              },
              nextAction: `🚨 BROKER APPROVAL REQUIRED: Agent recommends ACCEPTING this offer based on analysis.

Offer: $${currentOffer.amount.toLocaleString()} (${analysis.offerPercentage}% of asking)
Recommendation: ${analysis.recommendation.toUpperCase()}
Reasoning: ${analysis.reasoning}

Please review the analysis and draft acceptance message, then type your decision:
- "approve" or "acepta la oferta" → Proceed to legal stage
- "modify [instructions]" → Adjust terms
- "reject" → Decline/counter offer

⚖️ Legal Protection: Human broker approval required for all offer acceptances per real estate licensing laws.`,
            },
          },
        };

        // ⏸️ ROUTE TO HUMAN NODE: Let human node handle the interrupt
        return new Command({
          update: updatedState,
          goto: 'human', // Route to human node for input
        });
      } else if (analysis.recommendation === 'counter_offer') {
        // ✅ COUNTER-OFFERS are safe to auto-execute (not a legal commitment, buyer can reject)
        this.log('Sending counter-offer automatically', {
          original: currentOffer.amount,
          counter: analysis.suggestedCounterOffer,
        });

        await this.sendCounterOffer(currentOffer, property, analysis);

        return {
          stage: 'negotiation',
          humanInterventionRequired: false, // ✅ Auto-execute (safe)
          currentOffer: {
            ...currentOffer,
            status: 'counter_offered',
            counterOfferAmount: analysis.suggestedCounterOffer || undefined,
            counterOfferConditions: analysis.suggestedConditions,
          },
          offerHistory: [...offerHistory, currentOffer],
          agentOutputs: {
            ...state.agentOutputs,
            negotiation: {
              agentName: this.config.name,
              timestamp: new Date(),
              success: true,
              data: {
                ...analysis,
                autoExecuted: true,
                legalNotice: 'Counter-offer sent automatically (not a binding commitment)',
              },
              nextAction: `✅ Counter-offer sent automatically to buyer.

Original Offer: $${currentOffer.amount.toLocaleString()} (${analysis.offerPercentage}% of asking)
Counter-Offer: $${analysis.suggestedCounterOffer?.toLocaleString()}
Reasoning: ${analysis.reasoning}

Status: Awaiting buyer response. Broker will be notified if buyer accepts counter-offer.`,
            },
          },
        };
      } else {
        // REJECT the offer
        const offerPercentage = (currentOffer.amount / property.price) * 100;

        if (offerPercentage < 75) {
          // ✅ Low-ball offers (<75%) can be auto-rejected safely
          this.log('Auto-rejecting low-ball offer', {
            offerId: currentOffer.id,
            offerPercentage: offerPercentage.toFixed(1) + '%',
          });

          await this.sendRejectionMessage(currentOffer, property, analysis);

          return {
            stage: 'negotiation',
            humanInterventionRequired: false, // ✅ Auto-reject (safe)
            currentOffer: {
              ...currentOffer,
              status: 'rejected',
            },
            offerHistory: [...offerHistory, { ...currentOffer, status: 'rejected' }],
            agentOutputs: {
              ...state.agentOutputs,
              negotiation: {
                agentName: this.config.name,
                timestamp: new Date(),
                success: true,
                data: {
                  ...analysis,
                  autoExecuted: true,
                  legalNotice: 'Low-ball offer rejected automatically (< 75% asking price)',
                },
                nextAction: `✅ Low-ball offer rejected automatically.

Offer: $${currentOffer.amount.toLocaleString()} (${offerPercentage.toFixed(1)}% of asking)
Asking Price: $${property.price.toLocaleString()}
Reasoning: ${analysis.reasoning}

Status: Polite rejection sent. Waiting for new offers.`,
              },
            },
          };
        } else {
          // ⚠️ Rejecting reasonable offers (>75%) requires broker confirmation
          this.log('Recommendation: REJECT offer - Requires broker confirmation (offer is >75%)', {
            offerId: currentOffer.id,
            offerPercentage: offerPercentage.toFixed(1) + '%',
          });

          // Draft rejection message (don't send yet)
          const draftMessage = this.draftRejectionMessage(currentOffer, property, analysis);

          // Update state BEFORE interrupt
          const updatedState: Partial<PropertyWorkflowStateType> = {
            stage: 'negotiation',
            currentOffer: {
              ...currentOffer,
              status: 'pending',
            },
            offerHistory: [...offerHistory, currentOffer],
            agentOutputs: {
              ...state.agentOutputs,
              negotiation: {
                agentName: this.config.name,
                timestamp: new Date(),
                success: true,
                data: {
                  ...analysis,
                  recommendation: 'reject',
                  requiresBrokerConfirmation: true,
                  draftRejectionMessage: draftMessage,
                  legalNotice: 'BROKER CONFIRMATION REQUIRED: Rejecting decent offers (>75%) requires approval to avoid missed opportunities.',
                },
                nextAction: `⚠️ BROKER CONFIRMATION REQUIRED: Agent recommends REJECTING this offer.

Offer: $${currentOffer.amount.toLocaleString()} (${offerPercentage.toFixed(1)}% of asking)
Asking Price: $${property.price.toLocaleString()}
Recommendation: ${analysis.recommendation.toUpperCase()}
Reasoning: ${analysis.reasoning}

⚠️ WARNING: This offer is ${offerPercentage.toFixed(1)}% of asking price (above low-ball threshold).
Rejecting it may be a missed opportunity. Please review carefully.

Please type your decision:
- "confirm" or "reject" → Send rejection
- "counter" → Send counter-offer instead
- "accept" → Override AI and accept offer

💡 Tip: Consider market conditions and days on market before rejecting.`,
              },
            },
          };

          // ⏸️ ROUTE TO HUMAN NODE: Let human node handle the interrupt
          return new Command({
            update: updatedState,
            goto: 'human', // Route to human node for input
          });
        }
      }
    } catch (error) {
      this.logError('Negotiation failed', error);

      return {
        stage: 'negotiation',
        humanInterventionRequired: true,
        agentOutputs: {
          ...state.agentOutputs,
          negotiation: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: false,
            data: null,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        },
        errors: [...(state.errors || []), `Negotiation Agent failed: ${error}`],
      };
    }
  }

  /**
   * Analyze an offer using tools and market data
   */
  private async analyzeOffer(offer: Offer, property: any, state: PropertyWorkflowStateType): Promise<any> {
    this.log('Analyzing offer', { offerId: offer.id, amount: offer.amount });

    // Step 1: Get market data
    const marketTool = this.config.tools.find((t) => t.name === 'fetch_market_data');
    if (!marketTool) {
      throw new Error('fetch_market_data tool not found');
    }

    const marketResult = await marketTool.func({
      propertyType: property.propertyType,
      location: {
        city: property.address.city,
        state: property.address.state,
        zipCode: property.address.zipCode,
      },
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      squareFeet: property.squareFeet,
    });

    const marketData = JSON.parse(marketResult);

    // Step 2: Analyze the offer
    const analysisTool = this.config.tools.find((t) => t.name === 'analyze_offer');
    if (!analysisTool) {
      throw new Error('analyze_offer tool not found');
    }

    const analysisResult = await analysisTool.func({
      offerAmount: offer.amount,
      askingPrice: property.price,
      conditions: offer.conditions,
      earnestMoney: offer.amount * 0.01, // Assume 1% earnest money
      closingDate: offer.expiresAt.toISOString(),
      marketData: {
        averagePrice: marketData.averagePrice,
        daysOnMarket: 35, // TODO: Track actual days on market
        marketTrend: marketData.marketTrend,
      },
    });

    return JSON.parse(analysisResult);
  }

  /**
   * Draft acceptance message (for broker review)
   */
  private draftAcceptanceMessage(offer: Offer, property: any): string {
    return `Subject: Offer Accepted - ${property.address.city} Property

Dear Buyer,

We are pleased to inform you that your offer on the property at ${property.address.street}, ${property.address.city}, ${property.address.state} has been accepted.

Offer Details:
- Purchase Price: $${offer.amount.toLocaleString()}
- Property: ${property.bedrooms} bed / ${property.bathrooms} bath ${property.propertyType}
- Location: ${property.address.city}, ${property.address.state}

Next Steps:
1. Our legal team will prepare the purchase contract
2. You will receive the contract within 24-48 hours
3. Please coordinate with your lender for final approval
4. Schedule the home inspection at your earliest convenience

We look forward to a smooth closing process. Our team will be in touch shortly with next steps.

Congratulations on your new home!

Best regards,
BR SCALE Real Estate Team`;
  }

  /**
   * Send acceptance message (after broker approval)
   */
  private async sendAcceptanceMessage(offer: Offer, property: any): Promise<void> {
    const emailTool = this.config.tools.find((t) => t.name === 'send_email');
    if (!emailTool) return;

    const message = `Subject: Offer Accepted - ${property.address.city} Property

Dear Buyer,

We are pleased to inform you that your offer on the property at ${property.address.street}, ${property.address.city}, ${property.address.state} has been accepted.

Offer Details:
- Purchase Price: $${offer.amount.toLocaleString()}
- Property: ${property.bedrooms} bed / ${property.bathrooms} bath ${property.propertyType}
- Location: ${property.address.city}, ${property.address.state}

Next Steps:
1. Our legal team will prepare the purchase contract
2. You will receive the contract within 24-48 hours
3. Please coordinate with your lender for final approval
4. Schedule the home inspection at your earliest convenience

We look forward to a smooth closing process. Our team will be in touch shortly with next steps.

Congratulations on your new home!

Best regards,
BR SCALE Real Estate Team`;

    await emailTool.func({
      to: 'buyer@example.com', // TODO: Get actual buyer email
      subject: `Offer Accepted - ${property.address.city} Property`,
      body: message,
      propertyId: property.id,
    });

    this.log('Acceptance message sent');
  }

  /**
   * Send counter-offer
   */
  private async sendCounterOffer(offer: Offer, property: any, analysis: any): Promise<void> {
    const emailTool = this.config.tools.find((t) => t.name === 'send_email');
    if (!emailTool) return;

    const message = `Subject: Counter-Offer - ${property.address.city} Property

Dear Buyer,

Thank you for your offer on the property at ${property.address.street}, ${property.address.city}, ${property.address.state}.

Original Offer: $${offer.amount.toLocaleString()}
Counter-Offer: $${analysis.suggestedCounterOffer.toLocaleString()}

Reasoning:
${analysis.reasoning}

This counter-offer reflects the current market conditions and the property's value. The property has received strong interest, and we believe this price represents fair market value.

Market Context:
- Average comparable properties: $${analysis.factors.includes('averagePrice') ? 'see attached' : 'available upon request'}
- Current market trend: ${analysis.factors.includes('market') ? 'see attached' : 'stable'}

This counter-offer is valid for 48 hours. We look forward to your response.

Best regards,
BR SCALE Real Estate Team`;

    await emailTool.func({
      to: 'buyer@example.com',
      subject: `Counter-Offer - ${property.address.city} Property`,
      body: message,
      propertyId: property.id,
    });

    this.log('Counter-offer sent', { amount: analysis.suggestedCounterOffer });
  }

  /**
   * Draft rejection message (for broker review)
   */
  private draftRejectionMessage(offer: Offer, property: any, analysis: any): string {
    return `Subject: Offer Response - ${property.address.city} Property

Dear Buyer,

Thank you for your interest in the property at ${property.address.street}, ${property.address.city}, ${property.address.state}.

After careful consideration, we are unable to accept your offer at this time.

${analysis.reasoning}

We appreciate your interest and encourage you to submit a revised offer if you remain interested in the property.

Best regards,
BR SCALE Real Estate Team`;
  }

  /**
   * Send rejection message (after broker confirmation or auto for low-ball)
   */
  private async sendRejectionMessage(offer: Offer, property: any, analysis: any): Promise<void> {
    const emailTool = this.config.tools.find((t) => t.name === 'send_email');
    if (!emailTool) return;

    const message = `Subject: Offer Response - ${property.address.city} Property

Dear Buyer,

Thank you for your interest in the property at ${property.address.street}, ${property.address.city}, ${property.address.state}.

After careful consideration, we are unable to accept your offer at this time.

${analysis.reasoning}

We appreciate your interest and encourage you to submit a revised offer if you remain interested in the property.

Best regards,
BR SCALE Real Estate Team`;

    await emailTool.func({
      to: 'buyer@example.com',
      subject: `Offer Response - ${property.address.city} Property`,
      body: message,
      propertyId: property.id,
    });

    this.log('Rejection message sent');
  }

  /**
   * Simulate incoming offer (for demo)
   */
  private simulateIncomingOffer(propertyId: string, askingPrice: number): Offer {
    // Simulate a reasonable offer (92% of asking price)
    const offerAmount = Math.round(askingPrice * 0.92);

    return {
      id: `offer_${Date.now()}`,
      propertyId,
      leadId: `lead_${Date.now()}`,
      amount: offerAmount,
      conditions: ['Inspection contingency', 'Financing contingency'],
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };
  }

  /**
   * Single LLM call to interpret human intent AND generate response
   * More efficient than separate calls for interpretation + response generation
   */
  private async interpretAndRespond(
    humanMessage: string,
    offer: Offer,
    property: any,
    analysisData: any
  ): Promise<{ decision: string; response: string; reasoning?: string }> {
    // Define structured output schema
    const ResponseSchema = z.object({
      decision: z.enum(['APPROVE', 'REJECT', 'MODIFY', 'DISCUSS']).describe(
        'APPROVE = broker wants to accept the offer, REJECT = broker wants to reject, MODIFY = broker wants changes to analysis, DISCUSS = broker has questions or wants to discuss'
      ),
      response: z.string().describe(
        'Your response to the broker. If DISCUSS, answer their question. If APPROVE/REJECT/MODIFY, acknowledge their decision.'
      ),
      reasoning: z.string().optional().describe('Brief explanation of your interpretation'),
    });

    const llmWithStructuredOutput = this.model.withStructuredOutput(ResponseSchema);

    const prompt = `You are a professional real estate negotiation agent. Analyze the broker's message and determine their intent, then generate an appropriate response.

CONTEXT:
- Property: ${property.bedrooms} bed / ${property.bathrooms} bath ${property.propertyType}
- Location: ${property.address.city}, ${property.address.state}
- Asking Price: $${property.price.toLocaleString()}
- Current Offer: $${offer.amount.toLocaleString()} (${((offer.amount / property.price) * 100).toFixed(1)}% of asking)
- Your Previous Recommendation: ${analysisData.recommendation?.toUpperCase()}
- Your Reasoning: ${analysisData.reasoning}

BROKER'S MESSAGE: "${humanMessage}"

TASK:
1. Determine their intent:
   - APPROVE: They want to accept the offer (phrases like "acepta", "approve", "let's accept", "go ahead")
   - REJECT: They want to reject the offer (phrases like "rechaza", "reject", "decline", "no deal")
   - MODIFY: They want changes to your analysis (phrases like "reconsider", "look at again", "modify")
   - DISCUSS: They have questions or want to discuss (phrases like "why", "por que", "explain", "tell me more")

2. Generate a professional response:
   - If DISCUSS: Answer their question thoroughly but concisely (2-3 sentences)
   - If APPROVE/REJECT/MODIFY: Acknowledge and confirm what you'll do next

Be conversational, helpful, and maintain a collaborative tone.`;

    const result = await llmWithStructuredOutput.invoke(prompt);
    return result as { decision: string; response: string; reasoning?: string };
  }
}
