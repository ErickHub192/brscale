/**
 * API Routes: Single Property
 * GET /api/properties/:id - Get property by ID
 * PUT /api/properties/:id - Update property
 * DELETE /api/properties/:id - Delete property
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupabasePropertyRepository } from '@/infrastructure/database/supabase/SupabasePropertyRepository';

/**
 * GET /api/properties/:id
 * Get property by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    console.log('[API] Getting property:', propertyId);

    const propertyRepository = new SupabasePropertyRepository();
    const property = await propertyRepository.findById(propertyId);

    if (!property) {
      return NextResponse.json(
        {
          success: false,
          error: 'Property not found',
        },
        { status: 404 }
      );
    }

    const propertyData = property.toJSON();
    console.log('[API] Property retrieved', { id: propertyData.id, title: propertyData.title });

    return NextResponse.json({
      success: true,
      data: {
        property: propertyData,
      },
    });
  } catch (error) {
    console.error('[API] Error getting property:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/properties/:id
 * Update property
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const body = await request.json();

    console.log('[API] Updating property:', propertyId);

    // Get user ID from request
    const userId = body.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID required' },
        { status: 401 }
      );
    }

    const propertyRepository = new SupabasePropertyRepository();

    // Get existing property to verify ownership
    const existingProperty = await propertyRepository.findById(propertyId);

    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    const existingPropertyData = existingProperty.toJSON();

    if (existingPropertyData.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this property' },
        { status: 403 }
      );
    }

    // Update property
    const updatedProperty = await propertyRepository.update(propertyId, {
      title: body.title !== undefined ? body.title : existingPropertyData.title,
      description:
        body.description !== undefined ? body.description : existingPropertyData.description,
      address: body.address !== undefined ? body.address : existingPropertyData.address,
      price: body.price !== undefined ? body.price : existingPropertyData.price,
      bedrooms: body.bedrooms !== undefined ? body.bedrooms : existingPropertyData.bedrooms,
      bathrooms: body.bathrooms !== undefined ? body.bathrooms : existingPropertyData.bathrooms,
      squareFeet:
        body.squareFeet !== undefined ? body.squareFeet : existingPropertyData.squareFeet,
      propertyType:
        body.propertyType !== undefined ? body.propertyType : existingPropertyData.propertyType,
      images: body.images !== undefined ? body.images : existingPropertyData.images,
      videos: body.videos !== undefined ? body.videos : existingPropertyData.videos,
    });

    const updatedPropertyData = updatedProperty.toJSON();
    console.log('[API] Property updated successfully', { id: updatedPropertyData.id });

    return NextResponse.json({
      success: true,
      message: 'Property updated successfully',
      data: {
        property: {
          id: updatedPropertyData.id,
          title: updatedPropertyData.title,
          status: updatedPropertyData.status,
        },
      },
    });
  } catch (error) {
    console.error('[API] Error updating property:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/properties/:id
 * Delete property
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    console.log('[API] Deleting property:', propertyId);

    // Get user ID from request
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID required' },
        { status: 401 }
      );
    }

    const propertyRepository = new SupabasePropertyRepository();

    // Get existing property to verify ownership
    const existingProperty = await propertyRepository.findById(propertyId);

    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    const existingPropertyData = existingProperty.toJSON();

    if (existingPropertyData.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this property' },
        { status: 403 }
      );
    }

    // Delete property
    await propertyRepository.delete(propertyId);

    console.log('[API] Property deleted successfully', { id: propertyId });

    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('[API] Error deleting property:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
