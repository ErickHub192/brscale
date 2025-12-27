/**
 * API Route: Get Workflow Status
 * GET /api/properties/:id/workflow
 * Returns current workflow status for a property
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIAgentOrchestratorService } from '@/application/services/AIAgentOrchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    console.log('[API] Getting workflow status for property:', propertyId);

    // Initialize orchestrator
    const orchestrator = new AIAgentOrchestratorService();

    // Get workflow status
    const status = await orchestrator.getWorkflowStatus(propertyId);

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: 'No workflow found for this property',
          message: 'Property has not been published yet or workflow has not started',
        },
        { status: 404 }
      );
    }

    console.log('[API] Workflow status retrieved', {
      propertyId,
      currentStage: status.currentStage,
      completed: status.completed,
    });

    // Return workflow status
    return NextResponse.json({
      success: true,
      data: {
        propertyId: status.propertyId,
        currentStage: status.currentStage,
        completed: status.completed,
        humanInterventionRequired: status.humanInterventionRequired || false,
        startedAt: status.startedAt,
        completedAt: status.completedAt || null,
        error: status.error || null,
        agentOutputs: status.agentOutputs || {},
      },
    });
  } catch (error) {
    console.error('[API] Error getting workflow status:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
