/**
 * API Route: Get Lead Conversation
 * GET /api/properties/:id/leads/:leadId/conversation
 * Retrieves the conversation history with a specific lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPropertyWorkflowState } from '@/infrastructure/ai/workflow/PropertySalesWorkflow';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const { id: propertyId, leadId } = await params;

    console.log('[API] Fetching lead conversation:', { propertyId, leadId });

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

    // Get lead conversation
    const leadConversation = state.leadConversations?.[leadId];

    if (!leadConversation) {
      return NextResponse.json(
        {
          success: false,
          error: `No conversation found for lead ${leadId}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        leadId: leadConversation.leadId,
        leadName: leadConversation.leadName,
        leadEmail: leadConversation.leadEmail,
        status: leadConversation.status,
        qualificationScore: leadConversation.qualificationScore,
        lastContact: leadConversation.lastContact,
        messages: leadConversation.messages,
        messageCount: leadConversation.messages.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching lead conversation:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
