// Supabase Property Repository Implementation
// Implements IPropertyRepository interface using Supabase

import { IPropertyRepository } from '@/domain/repositories';
import { Property, PropertyData, PropertyStatus, PropertyType } from '@/domain/entities';
import { supabase, Database } from './client';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];

export class SupabasePropertyRepository implements IPropertyRepository {
    async findById(id: string): Promise<Property | null> {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;

        return this.mapToEntity(data);
    }

    async findByUserId(userId: string): Promise<Property[]> {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error || !data) return [];

        return data.map(row => this.mapToEntity(row));
    }

    async findAll(): Promise<Property[]> {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('status', PropertyStatus.ACTIVE)
            .order('created_at', { ascending: false });

        if (error || !data) return [];

        return data.map(row => this.mapToEntity(row));
    }

    async create(propertyData: Omit<PropertyData, 'id' | 'createdAt' | 'updatedAt'>): Promise<Property> {
        const insertData = this.mapToRow(propertyData);

        const { data, error } = await supabase
            .from('properties')
            .insert(insertData as PropertyInsert)
            .select()
            .single();

        if (error || !data) {
            throw new Error(`Failed to create property: ${error?.message}`);
        }

        return this.mapToEntity(data);
    }

    async update(id: string, propertyData: Partial<PropertyData>): Promise<Property> {
        const updateData = this.mapToRow(propertyData);

        const { data, error } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new Error(`Failed to update property: ${error?.message}`);
        }

        return this.mapToEntity(data);
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('properties')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete property: ${error.message}`);
        }
    }

    // Helper method to map Domain (CamelCase) to Database (snake_case)
    private mapToRow(data: Partial<PropertyData>): Partial<PropertyInsert> {
        const row: any = {};
        const mapping: Record<string, keyof PropertyInsert> = {
            userId: 'user_id',
            title: 'title',
            description: 'description',
            address: 'address',
            price: 'price',
            bedrooms: 'bedrooms',
            bathrooms: 'bathrooms',
            squareFeet: 'square_feet',
            propertyType: 'property_type',
            status: 'status',
            images: 'images',
            videos: 'videos',
            aiEnhancedDescription: 'ai_enhanced_description',
            aiSuggestedPrice: 'ai_suggested_price',
            metadata: 'metadata'
        };

        Object.keys(data).forEach(key => {
            const dbKey = mapping[key] || key;
            const value = data[key as keyof PropertyData];

            if (value !== undefined) {
                row[dbKey] = value;
            }
        });

        return row;
    }

    // Helper method to map Database (snake_case) to Domain (CamelCase)
    private mapToEntity(row: PropertyRow): Property {
        return new Property({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            address: row.address as any,
            price: Number(row.price),
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms ? Number(row.bathrooms) : null,
            squareFeet: row.square_feet,
            propertyType: row.property_type as PropertyType,
            status: row.status as PropertyStatus,
            images: row.images,
            videos: row.videos,
            aiEnhancedDescription: row.ai_enhanced_description,
            aiSuggestedPrice: row.ai_suggested_price ? Number(row.ai_suggested_price) : null,
            metadata: row.metadata as Record<string, unknown>,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        });
    }
}
