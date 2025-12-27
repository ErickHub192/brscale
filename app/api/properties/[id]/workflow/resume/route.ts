/**
 * API Route: Resume Workflow
 * POST /api/properties/:id/workflow/resume
 * Resumes a paused workflow with human input
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

    // Extract message context
    const {
      humanResponse,
      humanRole = 'broker', // Default to broker if not specified
      leadId, // Optional: if it's a lead conversation
      leadEmail, // Optional: for lead identification
      leadPhone, // Optional: for lead identification
    } = body;

    console.log('[API] Resuming workflow for property:', {
      propertyId,
      humanResponse,
      humanRole,
      leadId,
    });

    const orchestrator = new AIAgentOrchestratorService();

    // Resume workflow with human response and context
    const result = await orchestrator.resumeWorkflow(propertyId, {
      humanResponse,
      humanRole,
      leadId,
      leadEmail,
      leadPhone,
    });

    console.log('[API] Workflow resumed successfully', {
      propertyId,
      currentStage: result.currentStage,
      humanInterventionRequired: result.humanInterventionRequired,
    });

    return NextResponse.json({
      success: true,
      message: 'Workflow resumed successfully',
      data: {
        workflow: result,
      },
    });
  } catch (error) {
    console.error('[API] Error resuming workflow:', error);

    // Check if it's a timeout error
    const isTimeout = error instanceof Error &&
      (error.message.includes('timeout') || error.message.includes('Connection terminated'));

    if (isTimeout) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database connection timeout. Please try again.',
          errorType: 'TIMEOUT',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
