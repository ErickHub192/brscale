/**
 * API Route: List Property Leads
 * GET /api/properties/:id/leads
 * Lists all leads and their conversations for a property
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPropertyWorkflowState } from '@/infrastructure/ai/workflow/PropertySalesWorkflow';
import { Lead, LeadConversation } from '@/infrastructure/ai/types/WorkflowState';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    console.log('[API] Fetching all leads for property:', propertyId);

    // Get workflow state
    const state = await getPropertyWorkflowState(propertyId);

    if (!state) {
      return NextResponse.json(
        {
          success: false,
          error: 'No workflow found for this property',
        },
        { status: 404 }
      );
    }

    // Get all lead conversations
    const leadConversations = state.leadConversations || {};
    const leads: Lead[] = state.leads || [];

    // Format lead data
    const formattedLeads = (Object.values(leadConversations) as LeadConversation[]).map((conversation) => {
      // Find matching lead in leads array
      const lead = leads.find((l) => l.id === conversation.leadId);

      return {
        leadId: conversation.leadId,
        leadName: conversation.leadName,
        leadEmail: conversation.leadEmail,
        status: conversation.status,
        qualificationScore: conversation.qualificationScore,
        lastContact: conversation.lastContact,
        messageCount: conversation.messages.length,
        lastMessage: conversation.messages[conversation.messages.length - 1],
        // Include additional lead data if available
        leadInfo: lead
          ? {
              phone: lead.phone,
              source: lead.source,
              leadStatus: lead.status,
              notes: lead.notes,
              createdAt: lead.createdAt,
            }
          : null,
      };
    });

    // Sort by last contact (most recent first)
    formattedLeads.sort((a, b) => {
      return new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime();
    });

    // Calculate summary stats
    const stats = {
      totalLeads: formattedLeads.length,
      activeConversations: formattedLeads.filter((l) => l.status === 'active').length,
      qualifiedLeads: formattedLeads.filter((l) => l.status === 'qualified').length,
      readyForOffer: formattedLeads.filter((l) => l.status === 'ready_for_offer').length,
      coldLeads: formattedLeads.filter((l) => l.status === 'cold').length,
      averageQualificationScore:
        formattedLeads.length > 0
          ? Math.round(
              formattedLeads.reduce((sum, l) => sum + l.qualificationScore, 0) /
                formattedLeads.length
            )
          : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        currentStage: state.stage,
        stats,
        leads: formattedLeads,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching leads:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
