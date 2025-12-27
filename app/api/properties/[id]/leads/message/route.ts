/**
 * API Route: Lead Message
 * POST /api/properties/:id/leads/message
 * Simulates a lead (potential buyer) sending a message about a property
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIAgentOrchestratorService } from '@/application/services/AIAgentOrchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const body = await request.json();

    const {
      message,
      leadEmail,
      leadPhone,
      leadName,
    } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('[API] Lead message received for property:', {
      propertyId,
      message,
      leadEmail,
      leadPhone,
    });

    // Determine leadId based on email or phone (simulate lead identification)
    let leadId: string;
    if (leadEmail) {
      // Use email as identifier (in production, lookup in database)
      leadId = `lead_email_${leadEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    } else if (leadPhone) {
      // Use phone as identifier
      leadId = `lead_phone_${leadPhone.replace(/[^0-9]/g, '')}`;
    } else {
      // Generate new lead ID
      leadId = `lead_${Date.now()}`;
    }

    console.log('[API] Identified lead:', { leadId, leadEmail, leadPhone });

    const orchestrator = new AIAgentOrchestratorService();

    // Get current workflow status
    const workflowStatus = await orchestrator.getWorkflowStatus(propertyId);

    if (!workflowStatus) {
      return NextResponse.json(
        {
          success: false,
          error: 'No workflow found for this property. Please create the property first.',
        },
        { status: 404 }
      );
    }

    // Check if workflow is in lead_management stage or hasn't started yet
    if (workflowStatus.currentStage !== 'lead_management') {
      return NextResponse.json(
        {
          success: false,
          error: `Property workflow is currently in ${workflowStatus.currentStage} stage. Lead messages can only be sent during lead_management stage.`,
        },
        { status: 400 }
      );
    }

    // Resume workflow with lead message
    const result = await orchestrator.resumeWorkflow(propertyId, {
      humanResponse: message,
      humanRole: 'lead',
      leadId,
      leadEmail,
      leadPhone,
    });

    console.log('[API] Lead message processed successfully', {
      propertyId,
      leadId,
      currentStage: result.currentStage,
    });

    // Extract agent response from workflow
    const leadManagerOutput = result.agentOutputs?.lead_manager;
    const agentResponse = leadManagerOutput?.data?.agentResponse || leadManagerOutput?.nextAction;
    const leadStatus = leadManagerOutput?.data?.leadStatus;
    const qualificationScore = leadManagerOutput?.data?.qualificationScore;
    const readyForOffer = leadManagerOutput?.data?.leadConverted || false;

    return NextResponse.json({
      success: true,
      message: 'Lead message processed',
      data: {
        leadId,
        agentResponse,
        leadStatus,
        qualificationScore,
        readyForOffer,
        workflowAdvanced: result.currentStage !== 'lead_management',
        currentStage: result.currentStage,
      },
    });
  } catch (error) {
    console.error('[API] Error processing lead message:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
