/**
 * API Routes: Properties Collection
 * GET /api/properties - List all properties
 * POST /api/properties - Create new property
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupabasePropertyRepository } from '@/infrastructure/database/supabase/SupabasePropertyRepository';
import { CreatePropertyUseCase } from '@/application/use-cases/property/CreateProperty';

/**
 * GET /api/properties
 * List all properties (with optional filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    console.log('[API] Listing properties', { userId, status });

    const propertyRepository = new SupabasePropertyRepository();

    let properties;

    if (userId) {
      // Get properties for specific user
      properties = await propertyRepository.findByUserId(userId);
    } else {
      // Get all properties (or filter by status)
      properties = await propertyRepository.findAll();
    }

    // Filter by status if provided
    if (status) {
      properties = properties.filter((p) => p.toJSON().status === status);
    }

    console.log('[API] Properties retrieved', { count: properties.length });

    return NextResponse.json({
      success: true,
      data: {
        properties: properties.map((p) => {
          const data = p.toJSON();
          return {
            id: data.id,
            userId: data.userId,
            title: data.title,
            description: data.description,
            address: data.address,
            price: data.price,
            bedrooms: data.bedrooms,
            bathrooms: data.bathrooms,
            squareFeet: data.squareFeet,
            propertyType: data.propertyType,
            status: data.status,
            images: data.images,
            videos: data.videos,
            createdAt: data.metadata?.createdAt,
            updatedAt: data.metadata?.updatedAt,
          };
        }),
        total: properties.length,
      },
    });
  } catch (error) {
    console.error('[API] Error listing properties:', error);

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
 * POST /api/properties
 * Create new property
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API] Creating property', { title: body.title, body });

    // Validate required fields
    const requiredFields = ['userId', 'title', 'description', 'address', 'price'];
    for (const field of requiredFields) {
      if (!body[field]) {
        console.error('[API] Missing required field:', field, 'Body:', body);
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    // Initialize repository and use case
    const propertyRepository = new SupabasePropertyRepository();
    const createPropertyUseCase = new CreatePropertyUseCase(propertyRepository);

    console.log('[API] Executing CreatePropertyUseCase...');

    // Execute use case
    const result = await createPropertyUseCase.execute({
      userId: body.userId,
      title: body.title,
      description: body.description,
      address: body.address,
      price: body.price,
      bedrooms: body.bedrooms || 0,
      bathrooms: body.bathrooms || 0,
      squareFeet: body.squareFeet || 0,
      propertyType: body.propertyType || 'house',
      images: body.images || [],
      videos: body.videos || [],
    });

    console.log('[API] CreatePropertyUseCase result:', { success: result.success, message: result.message });

    if (!result.success) {
      console.error('[API] CreatePropertyUseCase failed:', result.message);
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 400 }
      );
    }

    const createdPropertyData = result.property.toJSON();
    console.log('[API] Property created successfully', { id: createdPropertyData.id });

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: {
          property: {
            id: createdPropertyData.id,
            userId: createdPropertyData.userId,
            title: createdPropertyData.title,
            status: createdPropertyData.status,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating property:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
