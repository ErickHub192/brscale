/**
 * Lead Manager Agent
 * Qualifies leads, schedules visits, and manages follow-up sequences
 */

import { BaseAgent, AgentConfig } from './BaseAgent';
import { PropertyWorkflowStateType, Lead, LeadConversation } from '../types/WorkflowState';
import { TOOL_CATEGORIES } from '../tools/allTools';
import { AI_CONFIG } from '@/infrastructure/config/env';
import { Command } from '@langchain/langgraph';
import { z } from 'zod';

export class LeadManagerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Lead Manager',
      description:
        'Qualifies incoming leads, schedules property visits, and manages automated follow-up sequences',
      tools: TOOL_CATEGORIES.LEAD_MANAGER,
      temperature: AI_CONFIG.temperature.precise, // 0.3 for consistent decision-making
      maxTokens: AI_CONFIG.maxTokens.medium, // 1500 tokens
      systemPrompt: `You are the Lead Manager Agent for BR SCALE real estate platform.

Your responsibilities:
1. **Qualify Leads**: Score and categorize every incoming lead (hot, qualified, needs_nurturing, cold)
2. **Prioritize Follow-up**: High-score leads get immediate attention, low-score leads get nurture campaigns
3. **Schedule Visits**: For qualified leads, schedule property visits based on their preferences and availability
4. **Automated Communication**: Send personalized follow-ups via WhatsApp, Email, or SMS based on lead preferences
5. **Persistent Nurturing**: Never let a lead go cold - set up automated sequences

Tools available:
- qualify_lead: Score and categorize leads (0-100 score)
- schedule_property_visit: Schedule visits on Google Calendar
- check_calendar_availability: Find available time slots
- send_whatsapp_message: Send WhatsApp messages
- send_email: Send emails
- send_sms: Send SMS messages
- send_followup_sequence: Start automated nurture sequences

Lead Qualification Criteria:
- Contact completeness (phone + email)
- Budget alignment with property price
- Pre-approval status
- Timeline urgency
- Message quality and engagement

Lead Categories:
- **HOT** (85-100): Schedule visit immediately, call within 1 hour
- **QUALIFIED** (70-84): Schedule visit within 24 hours, send detailed info
- **NEEDS_NURTURING** (50-69): Add to nurture campaign, follow up in 2-3 days
- **COLD** (<50): Long-term nurture, low priority

Communication Strategy:
- Be personal and authentic
- Match the lead's communication style
- Reference specific property features they asked about
- Always provide value (market insights, neighborhood info)
- Make scheduling easy (offer specific times)`,
    };

    super(config);
  }

  async execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType> | Command> {
    this.log('Starting lead qualification and management');

    try {
      const {
        property,
        propertyId,
        leads = [],
        leadConversations = {},
        humanResponse,
        humanRole,
        currentLeadId,
      } = state;

      // Handle LEAD conversations (potential buyers asking questions)
      if (humanResponse && humanRole === 'lead' && currentLeadId) {
        this.log('Processing lead conversation', { leadId: currentLeadId, message: humanResponse });

        // Get or create lead conversation
        let leadConversation = leadConversations[currentLeadId];

        if (!leadConversation) {
          // New lead - create conversation
          leadConversation = {
            leadId: currentLeadId,
            leadName: `Lead ${currentLeadId.slice(-4)}`, // TODO: Get real name from form
            leadEmail: `lead_${currentLeadId}@example.com`, // TODO: Get real email
            messages: [],
            lastContact: new Date(),
            status: 'active',
            qualificationScore: 50, // Start at neutral
          };
        }

        // Add lead's message to conversation
        leadConversation.messages.push({
          role: 'human',
          content: humanResponse,
          timestamp: new Date(),
        });

        // Generate agent response using LLM
        const agentResponse = await this.respondToLead(humanResponse, property, leadConversation);

        // Add agent's response to conversation
        leadConversation.messages.push({
          role: 'assistant',
          content: agentResponse.message,
          timestamp: new Date(),
          agentName: this.config.name,
        });

        // Update qualification score based on conversation
        leadConversation.qualificationScore = agentResponse.updatedQualificationScore;
        leadConversation.status = agentResponse.leadStatus;
        leadConversation.lastContact = new Date();

        // Check if lead is ready to make an offer
        if (agentResponse.readyForOffer) {
          this.log('Lead is ready to make an offer!', { leadId: currentLeadId });

          // Create the lead in the leads array if not exists
          const existingLead = leads.find((l) => l.id === currentLeadId);
          const newLead: Lead = existingLead || {
            id: currentLeadId,
            propertyId,
            name: leadConversation.leadName,
            email: leadConversation.leadEmail,
            phone: undefined,
            source: 'web',
            qualificationScore: leadConversation.qualificationScore,
            status: 'offer_made',
            notes: `Lead became qualified through conversation. Ready to make offer.`,
            createdAt: new Date(),
            lastContactedAt: new Date(),
          };

          // Update the lead to qualified status
          newLead.status = 'offer_made';
          newLead.qualificationScore = leadConversation.qualificationScore;

          const updatedLeads = existingLead
            ? leads.map((l) => (l.id === currentLeadId ? newLead : l))
            : [...leads, newLead];

          // Signal to advance to negotiation stage
          return {
            leads: updatedLeads,
            leadConversations: {
              ...leadConversations,
              [currentLeadId]: leadConversation,
            },
            agentOutputs: {
              ...state.agentOutputs,
              lead_manager: {
                agentName: this.config.name,
                timestamp: new Date(),
                success: true,
                data: {
                  leadConverted: true,
                  leadId: currentLeadId,
                  qualificationScore: leadConversation.qualificationScore,
                  conversationTurns: leadConversation.messages.length,
                  readyForNegotiation: true,
                },
                nextAction: `🎉 Lead ${currentLeadId} is ready to make an offer! Proceeding to Negotiation Agent.`,
              },
            },
          };
        }

        // Continue conversation - route back to human node
        return new Command({
          update: {
            leadConversations: {
              ...leadConversations,
              [currentLeadId]: leadConversation,
            },
            agentOutputs: {
              ...state.agentOutputs,
              lead_manager: {
                agentName: this.config.name,
                timestamp: new Date(),
                success: true,
                data: {
                  conversationMode: true,
                  leadId: currentLeadId,
                  leadStatus: leadConversation.status,
                  qualificationScore: leadConversation.qualificationScore,
                  agentResponse: agentResponse.message,
                },
                nextAction: agentResponse.message,
              },
            },
          },
          goto: 'human', // Continue conversation with lead
        });
      }

      // Check if BROKER wants to proceed to negotiation manually
      if (humanResponse && humanRole === 'broker') {
        this.log('Processing broker response on leads', { humanResponse });

        const leadStats = {
          totalLeads: leads.length,
          qualifiedLeads: leads.filter(l => l.qualificationScore >= 70).length,
          hotLeads: leads.filter(l => l.qualificationScore >= 85).length,
        };

        // Single LLM call to interpret intent AND generate response
        const interpretation = await this.interpretAndRespondToBroker(
          humanResponse,
          leadStats,
          property
        );

        this.log('Broker response interpreted', {
          decision: interpretation.decision,
          response: interpretation.response?.substring(0, 100),
          reasoning: interpretation.reasoning
        });

        const decision = interpretation.decision;

        // Strategy Pattern: Map decisions to handlers
        const decisionHandlers: Record<string, () => Promise<Partial<PropertyWorkflowStateType> | Command>> = {
          PROCEED: async () => {
            // Broker wants to proceed to negotiation
            const updatedState: Partial<PropertyWorkflowStateType> = {
              humanInterventionRequired: false,
              agentOutputs: {
                ...state.agentOutputs,
                lead_manager: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    humanOverride: true,
                    message: 'Broker manually advancing to negotiation stage',
                    readyForNegotiation: true, // Signal to proceed
                  },
                  nextAction: 'Proceeding to Negotiation Agent (broker override)',
                },
              },
            };

            // Don't use Command here - let workflow conditional edge handle routing
            return updatedState;
          },

          WAIT: async () => {
            // Continue managing leads
            return {};
          },

          DISCUSS: async () => {
            // Broker asked a question or wants to discuss
            this.log('Broker wants to discuss leads', {
              humanResponse,
              agentResponse: interpretation.response.substring(0, 100)
            });

            const updatedState: Partial<PropertyWorkflowStateType> = {
              stage: 'lead_management',
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
                lead_manager: {
                  agentName: this.config.name,
                  timestamp: new Date(),
                  success: true,
                  data: {
                    ...(state.agentOutputs?.lead_manager?.data || {}),
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

      if (!property) {
        throw new Error('Property data not found in state');
      }

      // For demo purposes, simulate incoming leads
      // In production, these would come from form submissions, inquiries, etc.
      const incomingLeads = this.simulateIncomingLeads(propertyId, property.price);

      this.log('Processing incoming leads', { count: incomingLeads.length });

      const qualifiedLeads: Lead[] = [];
      const processedLeads: Lead[] = [...leads];

      // Process each lead
      for (const lead of incomingLeads) {
        this.log('Qualifying lead', { leadId: lead.id, name: lead.name });

        // Step 1: Qualify the lead
        const qualificationTool = this.config.tools.find((t) => t.name === 'qualify_lead');
        if (!qualificationTool) {
          throw new Error('qualify_lead tool not found');
        }

        const qualificationResult = await qualificationTool.func({
          leadData: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone || '',
            source: lead.source,
            message: lead.notes,
            budget: this.estimateLeadBudget(lead, property.price),
            timeline: this.extractTimeline(lead.notes),
            preApproved: this.detectPreApproval(lead.notes),
          },
          propertyPrice: property.price,
        });

        const qualification = JSON.parse(qualificationResult);

        // Update lead with qualification data
        const qualifiedLead: Lead = {
          ...lead,
          qualificationScore: qualification.qualificationScore,
          status: this.mapQualificationStatus(qualification.status),
        };

        processedLeads.push(qualifiedLead);

        this.log('Lead qualified', {
          leadId: lead.id,
          score: qualification.qualificationScore,
          status: qualification.status,
        });

        // Step 2: Take action based on qualification
        if (qualification.status === 'hot' || qualification.status === 'qualified') {
          qualifiedLeads.push(qualifiedLead);

          // HIGH PRIORITY: Schedule visit immediately
          await this.scheduleVisitForLead(qualifiedLead, property);

          // Send immediate response
          await this.sendImmediateResponse(qualifiedLead, property, qualification);
        } else if (qualification.status === 'needs_nurturing') {
          // MEDIUM PRIORITY: Add to nurture sequence
          await this.startNurtureSequence(qualifiedLead, property);
        } else {
          // LOW PRIORITY: Long-term nurture
          await this.startLongTermNurture(qualifiedLead, property);
        }
      }

      this.log('Lead management complete', {
        totalProcessed: processedLeads.length,
        qualified: qualifiedLeads.length,
      });

      // Update state
      // If we have hot leads, automatically proceed to negotiation (simulating offer received)
      const hasHotLeads = processedLeads.some((l) => l.qualificationScore >= 85);

      return {
        leads: processedLeads,
        qualifiedLeads,
        agentOutputs: {
          ...state.agentOutputs,
          lead_manager: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: true,
            data: {
              totalLeads: processedLeads.length,
              qualifiedLeads: qualifiedLeads.length,
              hotLeads: processedLeads.filter((l) => l.qualificationScore >= 85).length,
              visitsScheduled: qualifiedLeads.length,
              nurtureSequencesStarted: incomingLeads.length - qualifiedLeads.length,
              readyForNegotiation: hasHotLeads, // Signal to workflow
            },
            nextAction: hasHotLeads
              ? 'Hot lead detected - proceeding to negotiation automatically'
              : 'Continue nurturing leads',
          },
        },
      };
    } catch (error) {
      this.logError('Lead management failed', error);

      return {
        stage: 'lead_management',
        humanInterventionRequired: true,
        agentOutputs: {
          ...state.agentOutputs,
          lead_manager: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: false,
            data: null,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        },
        errors: [...(state.errors || []), `Lead Manager failed: ${error}`],
      };
    }
  }

  /**
   * Schedule visit for qualified lead
   */
  private async scheduleVisitForLead(lead: Lead, property: any): Promise<void> {
    this.log('Scheduling visit for qualified lead', { leadId: lead.id });

    const scheduleTool = this.config.tools.find((t) => t.name === 'schedule_property_visit');
    if (!scheduleTool) {
      this.logError('schedule_property_visit tool not found');
      return;
    }

    // Calculate preferred visit time (next business day, afternoon)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const preferredDate = tomorrow.toISOString().split('T')[0];

    await scheduleTool.func({
      leadId: lead.id,
      leadEmail: lead.email,
      leadName: lead.name,
      propertyId: lead.propertyId,
      propertyAddress: `${property.address.street}, ${property.address.city}, ${property.address.state}`,
      preferredDate,
      preferredTime: '14:00',
      duration: 60,
    });

    this.log('Visit scheduled', { leadId: lead.id, date: preferredDate });
  }

  /**
   * Send immediate response to hot/qualified leads
   */
  private async sendImmediateResponse(
    lead: Lead,
    property: any,
    qualification: any
  ): Promise<void> {
    this.log('Sending immediate response', { leadId: lead.id, channel: lead.source });

    const channel = lead.source === 'whatsapp' ? 'whatsapp' : lead.phone ? 'sms' : 'email';

    let tool;
    let message = '';

    if (channel === 'whatsapp') {
      tool = this.config.tools.find((t) => t.name === 'send_whatsapp_message');
      message = `Hi ${lead.name}! 👋

Thanks for your interest in the ${property.propertyType} at ${property.address.city}. I can tell you're serious about finding the right place.

I'd love to show you this property. I have availability tomorrow at 2 PM. Does that work for you?

In the meantime, here are a few things that make this place special:
- ${property.bedrooms} bed / ${property.bathrooms} bath
- ${property.squareFeet} sq ft
- ${property.address.city} location

Let me know if you'd like to see it!`;
    } else if (channel === 'sms') {
      tool = this.config.tools.find((t) => t.name === 'send_sms');
      message = `Hi ${lead.name}, thanks for asking about the ${property.address.city} property! I'd love to show it to you tomorrow at 2 PM. Reply YES if that works.`;
    } else {
      tool = this.config.tools.find((t) => t.name === 'send_email');
      message = `Subject: Your inquiry about ${property.address.city} property

Hi ${lead.name},

Thank you for your interest in the ${property.propertyType} at ${property.address.city}. Based on what you shared, I think this could be exactly what you're looking for.

I'd love to schedule a private showing for you. I have availability tomorrow at 2 PM, or I can work around your schedule.

Property highlights:
- ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms
- ${property.squareFeet} square feet
- ${property.address.city}, ${property.address.state}
- Priced at $${property.price.toLocaleString()}

Reply to this email or call me directly to confirm a time that works for you.

Looking forward to showing you the property!`;
    }

    if (tool) {
      await tool.func({
        to: channel === 'email' ? lead.email : lead.phone || lead.email,
        message,
        leadId: lead.id,
        propertyId: lead.propertyId,
      });

      this.log('Immediate response sent', { leadId: lead.id, channel });
    }
  }

  /**
   * Start nurture sequence for medium-priority leads
   */
  private async startNurtureSequence(lead: Lead, property: any): Promise<void> {
    this.log('Starting nurture sequence', { leadId: lead.id });

    const sequenceTool = this.config.tools.find((t) => t.name === 'send_followup_sequence');
    if (!sequenceTool) {
      this.logError('send_followup_sequence tool not found');
      return;
    }

    await sequenceTool.func({
      leadId: lead.id,
      leadContact: {
        email: lead.email,
        phone: lead.phone,
        preferredChannel: lead.source === 'whatsapp' ? 'whatsapp' : 'email',
      },
      sequenceType: 'initial_contact',
      propertyId: lead.propertyId,
    });

    this.log('Nurture sequence started', { leadId: lead.id });
  }

  /**
   * Start long-term nurture for cold leads
   */
  private async startLongTermNurture(lead: Lead, property: any): Promise<void> {
    this.log('Starting long-term nurture', { leadId: lead.id });

    const sequenceTool = this.config.tools.find((t) => t.name === 'send_followup_sequence');
    if (!sequenceTool) {
      return;
    }

    await sequenceTool.func({
      leadId: lead.id,
      leadContact: {
        email: lead.email,
        phone: lead.phone,
        preferredChannel: 'email',
      },
      sequenceType: 'nurture',
      propertyId: lead.propertyId,
    });
  }

  /**
   * Simulate incoming leads (for demo purposes)
   */
  private simulateIncomingLeads(propertyId: string, propertyPrice: number): Lead[] {
    return [
      {
        id: `lead_${Date.now()}_1`,
        propertyId,
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        phone: '+1234567890',
        source: 'web',
        qualificationScore: 0,
        status: 'new',
        notes: 'Very interested! Looking to buy ASAP. Have pre-approval from bank.',
        createdAt: new Date(),
      },
      {
        id: `lead_${Date.now()}_2`,
        propertyId,
        name: 'Mike Chen',
        email: 'mike.chen@email.com',
        phone: '+1987654321',
        source: 'whatsapp',
        qualificationScore: 0,
        status: 'new',
        notes: 'Just browsing, might be interested in 6 months',
        createdAt: new Date(),
      },
    ];
  }

  /**
   * Helper: Estimate lead budget based on inquiry
   */
  private estimateLeadBudget(lead: Lead, propertyPrice: number): number {
    // If lead mentions pre-approval, assume they can afford it
    if (this.detectPreApproval(lead.notes)) {
      return propertyPrice;
    }
    // Otherwise, return undefined (budget unknown)
    return propertyPrice * 0.85;
  }

  /**
   * Helper: Extract timeline from lead notes
   */
  private extractTimeline(notes: string): string {
    const lowerNotes = notes.toLowerCase();
    if (lowerNotes.includes('asap') || lowerNotes.includes('immediately')) {
      return 'immediately';
    }
    if (lowerNotes.includes('month')) {
      return '1-3 months';
    }
    return 'flexible';
  }

  /**
   * Helper: Detect pre-approval in lead notes
   */
  private detectPreApproval(notes: string): boolean {
    const lowerNotes = notes.toLowerCase();
    return (
      lowerNotes.includes('pre-approval') ||
      lowerNotes.includes('preapproval') ||
      lowerNotes.includes('pre-approved')
    );
  }

  /**
   * Helper: Map qualification status to lead status
   */
  private mapQualificationStatus(
    status: 'hot' | 'qualified' | 'needs_nurturing' | 'cold'
  ): Lead['status'] {
    switch (status) {
      case 'hot':
      case 'qualified':
        return 'qualified';
      case 'needs_nurturing':
        return 'contacted';
      case 'cold':
        return 'new';
      default:
        return 'new';
    }
  }

  /**
   * Respond to lead using LLM in a conversational manner
   * Analyzes lead's question and generates appropriate response
   */
  private async respondToLead(
    leadMessage: string,
    property: any,
    conversation: LeadConversation
  ): Promise<{
    message: string;
    updatedQualificationScore: number;
    leadStatus: 'active' | 'waiting_response' | 'qualified' | 'ready_for_offer' | 'cold';
    readyForOffer: boolean;
  }> {
    this.log('Generating conversational response to lead', {
      leadId: conversation.leadId,
      currentScore: conversation.qualificationScore,
    });

    // Build conversation context
    const conversationHistory = conversation.messages
      .map((m) => `${m.role === 'human' ? 'Lead' : 'Agent'}: ${m.content}`)
      .join('\n');

    const prompt = `You are a professional real estate agent having a conversation with a potential buyer.

Property Details:
- Address: ${property.address.street}, ${property.address.city}, ${property.address.state}
- Type: ${property.propertyType}
- Price: $${property.price.toLocaleString()}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms || 'N/A'}
- Square Feet: ${property.squareFeet || 'N/A'}
- Description: ${property.description || property.aiEnhancedDescription || 'Beautiful property'}

Lead Information:
- Current Qualification Score: ${conversation.qualificationScore}/100
- Conversation Status: ${conversation.status}

Conversation History:
${conversationHistory || 'This is the first message'}

Lead's Latest Message:
"${leadMessage}"

Your Tasks:
1. Respond to the lead's question professionally and helpfully
2. Assess if this message indicates higher buying intent (increase score) or lower (decrease score)
3. Determine if the lead is ready to make an offer (very interested, asking about next steps, etc.)

Respond in this EXACT JSON format:
{
  "message": "Your friendly, professional response here",
  "qualificationScoreChange": -10 to +10 (how much to adjust the score based on this message),
  "readyForOffer": true/false (is lead ready to make an offer now?),
  "reasoning": "Brief explanation of your assessment"
}

Guidelines:
- Be conversational and friendly, not robotic
- Answer questions directly and honestly
- If lead asks about price negotiation, mention they can make an offer
- If lead asks about scheduling, offer specific times
- If lead shows high intent ("I'm very interested", "I want to make an offer"), set readyForOffer to true
- Increase score for: serious questions, timeline mentions, financial discussions
- Decrease score for: just browsing, far future timeline, price complaints without intent`;

    try {
      const llmResponse = await this.model.invoke([
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: prompt },
      ]);

      const responseText = llmResponse.content.toString().trim();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM response not in JSON format');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Calculate new qualification score
      const scoreChange = Math.max(-10, Math.min(10, parsed.qualificationScoreChange || 0));
      const newScore = Math.max(0, Math.min(100, conversation.qualificationScore + scoreChange));

      // Determine lead status
      let leadStatus: LeadConversation['status'] = 'active';
      if (parsed.readyForOffer) {
        leadStatus = 'ready_for_offer';
      } else if (newScore >= 75) {
        leadStatus = 'qualified';
      } else if (newScore < 30) {
        leadStatus = 'cold';
      }

      this.log('Lead response generated', {
        scoreChange,
        newScore,
        readyForOffer: parsed.readyForOffer,
        reasoning: parsed.reasoning,
      });

      return {
        message: parsed.message,
        updatedQualificationScore: newScore,
        leadStatus,
        readyForOffer: parsed.readyForOffer || false,
      };
    } catch (error) {
      this.logError('Failed to generate lead response', error);

      // Fallback response
      return {
        message: `Thank you for your interest in this ${property.propertyType}! I'd be happy to help answer any questions. What would you like to know more about?`,
        updatedQualificationScore: conversation.qualificationScore,
        leadStatus: conversation.status,
        readyForOffer: false,
      };
    }
  }

  /**
   * Single LLM call to interpret broker intent AND generate response
   * More efficient than separate calls for interpretation + response generation
   */
  private async interpretAndRespondToBroker(
    humanMessage: string,
    leadStats: {
      totalLeads: number;
      qualifiedLeads: number;
      hotLeads: number;
    },
    property: any
  ): Promise<{ decision: string; response: string; reasoning?: string }> {
    // Define structured output schema
    const ResponseSchema = z.object({
      decision: z.enum(['PROCEED', 'WAIT', 'DISCUSS']).describe(
        'PROCEED = broker wants to advance to negotiation, WAIT = continue managing leads, DISCUSS = broker has questions'
      ),
      response: z.string().describe(
        'Your response to the broker. If DISCUSS, answer their question. If PROCEED/WAIT, acknowledge their decision.'
      ),
      reasoning: z.string().optional().describe('Brief explanation of your interpretation'),
    });

    const llmWithStructuredOutput = this.model.withStructuredOutput(ResponseSchema);

    const prompt = `You are a professional real estate lead manager agent. Analyze the broker's message and determine their intent, then generate an appropriate response.

CONTEXT:
- Property: ${property.bedrooms} bed / ${property.bathrooms} bath ${property.propertyType}
- Location: ${property.address.city}, ${property.address.state}
- Price: $${property.price.toLocaleString()}
- Total Leads: ${leadStats.totalLeads}
- Qualified Leads: ${leadStats.qualifiedLeads}
- Hot Leads: ${leadStats.hotLeads}

BROKER'S MESSAGE: "${humanMessage}"

TASK:
1. Determine their intent:
   - PROCEED: They want to move to negotiation stage (phrases like "proceed", "next", "advance", "go to negotiation")
   - WAIT: They want to continue managing leads (phrases like "wait", "more leads", "keep going", "not yet")
   - DISCUSS: They have questions or want to discuss (phrases like "why", "explain", "tell me", "what about")

2. Generate a professional response:
   - If DISCUSS: Answer their question about lead management (2-3 sentences)
   - If PROCEED/WAIT: Acknowledge and confirm what you'll do next

Be helpful, professional, and maintain a collaborative tone.`;

    const result = await llmWithStructuredOutput.invoke(prompt);
    return result as { decision: string; response: string; reasoning?: string };
  }
}
