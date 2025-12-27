// Use Case: Create Property
// Single Responsibility: Handle property creation with validation
// Auto-publishes property and starts AI workflow

import { IPropertyRepository } from '@/domain/repositories';
import { Property, PropertyData, PropertyStatus, PropertyType } from '@/domain/entities';
import { AIAgentOrchestratorService } from '@/application/services/AIAgentOrchestrator';

export interface CreatePropertyInput {
    userId: string;
    title: string;
    description: string;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    price: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    propertyType: PropertyType;
    images: string[];
    videos?: string[];
}

export interface CreatePropertyOutput {
    property: Property;
    success: boolean;
    message: string;
    workflowStarted?: boolean;
}

export class CreatePropertyUseCase {
    constructor(private propertyRepository: IPropertyRepository) { }

    async execute(input: CreatePropertyInput): Promise<CreatePropertyOutput> {
        try {
            // Validate input
            this.validateInput(input);

            // Create property data with ACTIVE status (auto-publish)
            const propertyData: Omit<PropertyData, 'id' | 'createdAt' | 'updatedAt'> = {
                userId: input.userId,
                title: input.title,
                description: input.description,
                address: input.address,
                price: input.price,
                bedrooms: input.bedrooms ?? null,
                bathrooms: input.bathrooms ?? null,
                squareFeet: input.squareFeet ?? null,
                propertyType: input.propertyType,
                status: PropertyStatus.ACTIVE, // Auto-publish
                images: input.images,
                videos: input.videos ?? [],
                aiEnhancedDescription: null,
                aiSuggestedPrice: null,
                metadata: {},
            };

            // Create property via repository
            const property = await this.propertyRepository.create(propertyData);

            // Auto-start AI workflow
            const orchestrator = new AIAgentOrchestratorService();

            let workflowStarted = false;
            try {
                await orchestrator.startPropertyWorkflow(property);
                workflowStarted = true;
                console.log('[CreateProperty] AI workflow started for property:', property.toJSON().id);
            } catch (workflowError) {
                console.error('[CreateProperty] Failed to start workflow:', workflowError);
                // Don't fail property creation if workflow fails
            }

            return {
                property,
                success: true,
                message: workflowStarted
                    ? 'Property created and AI workflow started successfully'
                    : 'Property created successfully (workflow start failed)',
                workflowStarted,
            };
        } catch (error) {
            return {
                property: null as any,
                success: false,
                message: error instanceof Error ? error.message : 'Failed to create property',
            };
        }
    }

    private validateInput(input: CreatePropertyInput): void {
        if (!input.title || input.title.trim().length === 0) {
            throw new Error('Title is required');
        }

        if (!input.description || input.description.trim().length === 0) {
            throw new Error('Description is required');
        }

        if (input.price <= 0) {
            throw new Error('Price must be greater than 0');
        }

        if (!input.images || input.images.length === 0) {
            throw new Error('At least one image is required');
        }

        if (!input.address.street || !input.address.city || !input.address.state) {
            throw new Error('Complete address is required');
        }
    }
}
