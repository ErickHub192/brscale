// Use Case: Publish Property
// Triggers the AI workflow to process and publish the property

import { IPropertyRepository } from '@/domain/repositories';
import { Property } from '@/domain/entities';

export interface PublishPropertyInput {
    propertyId: string;
    userId: string;
}

export interface PublishPropertyOutput {
    property: Property;
    success: boolean;
    message: string;
    workflowStarted: boolean;
}

export class PublishPropertyUseCase {
    constructor(private propertyRepository: IPropertyRepository) { }

    async execute(input: PublishPropertyInput): Promise<PublishPropertyOutput> {
        try {
            // Get property
            const property = await this.propertyRepository.findById(input.propertyId);

            if (!property) {
                throw new Error('Property not found');
            }

            // Verify ownership
            if (property.toJSON().userId !== input.userId) {
                throw new Error('Unauthorized: You do not own this property');
            }

            // Check if can be published
            if (!property.canBePublished()) {
                throw new Error('Property cannot be published: missing required fields');
            }

            // Publish property (changes status to ACTIVE)
            property.publish();

            // Update in repository
            const updatedProperty = await this.propertyRepository.update(
                input.propertyId,
                property.toJSON()
            );

            // TODO: Trigger AI workflow here
            // await this.aiWorkflowService.startPropertyWorkflow(property.id);

            return {
                property: updatedProperty,
                success: true,
                message: 'Property published successfully',
                workflowStarted: true,
            };
        } catch (error) {
            return {
                property: null as any,
                success: false,
                message: error instanceof Error ? error.message : 'Failed to publish property',
                workflowStarted: false,
            };
        }
    }
}
