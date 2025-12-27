/**
 * API Route: Publish Property
 * POST /api/properties/:id/publish
 * Publishes property and triggers AI workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupabasePropertyRepository } from '@/infrastructure/database/supabase/SupabasePropertyRepository';
import { PublishPropertyUseCase } from '@/application/use-cases/property/PublishProperty';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    // Get user session from request
    // TODO: Implement proper authentication middleware
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: No authorization header' },
        { status: 401 }
      );
    }

    // Extract user ID from token (simplified - use proper JWT validation in production)
    // For now, we'll get it from the request body
    const body = await request.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID required' },
        { status: 401 }
      );
    }

    console.log('[API] Publishing property:', { propertyId, userId });

    // Initialize repository and use case
    const propertyRepository = new SupabasePropertyRepository();
    const publishPropertyUseCase = new PublishPropertyUseCase(propertyRepository);

    // Execute use case
    const result = await publishPropertyUseCase.execute({
      propertyId,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 400 }
      );
    }

    console.log('[API] Property published successfully', {
      propertyId,
      workflowStarted: result.workflowStarted,
      currentStage: result.workflowStatus?.currentStage,
    });

    // Return success response
    const publishedPropertyData = result.property.toJSON();
    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        property: {
          id: publishedPropertyData.id,
          title: publishedPropertyData.title,
          status: publishedPropertyData.status,
        },
        workflow: {
          started: result.workflowStarted,
          currentStage: result.workflowStatus?.currentStage || null,
          humanInterventionRequired: result.workflowStatus?.humanInterventionRequired || false,
        },
      },
    });
  } catch (error) {
    console.error('[API] Error publishing property:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
