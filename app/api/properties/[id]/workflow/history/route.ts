/**
 * API Route: Get Workflow History
 * GET /api/properties/:id/workflow/history
 * Returns complete workflow execution history
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIAgentOrchestratorService } from '@/application/services/AIAgentOrchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    console.log('[API] Getting workflow history for property:', propertyId);

    // Initialize orchestrator
    const orchestrator = new AIAgentOrchestratorService();

    // Get workflow history
    const history = await orchestrator.getWorkflowHistory(propertyId);

    if (!history || history.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No workflow history found for this property',
        },
        { status: 404 }
      );
    }

    console.log('[API] Workflow history retrieved', {
      propertyId,
      totalCheckpoints: history.length,
    });

    // Return workflow history
    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        totalCheckpoints: history.length,
        history: history.map((checkpoint) => ({
          timestamp: checkpoint.timestamp,
          stage: checkpoint.stage,
          humanInterventionRequired: checkpoint.humanInterventionRequired,
          agentOutputs: checkpoint.agentOutputs,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Error getting workflow history:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
