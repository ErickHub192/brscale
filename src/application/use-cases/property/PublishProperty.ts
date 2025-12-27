/**
 * Use Case: Publish Property
 * Publishes property and triggers the AI multi-agent workflow
 */

import { IPropertyRepository } from '@/domain/repositories';
import { Property } from '@/domain/entities';
import { AIAgentOrchestratorService } from '@/application/services/AIAgentOrchestrator';

export interface PublishPropertyInput {
  propertyId: string;
  userId: string;
}

export interface PublishPropertyOutput {
  property: Property;
  success: boolean;
  message: string;
  workflowStarted: boolean;
  workflowStatus?: {
    currentStage: string;
    humanInterventionRequired: boolean;
  };
}

export class PublishPropertyUseCase {
  private orchestrator: AIAgentOrchestratorService;

  constructor(private propertyRepository: IPropertyRepository) {
    this.orchestrator = new AIAgentOrchestratorService();
  }

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

      // ✨ Trigger AI multi-agent workflow
      console.log('[PublishProperty] Starting AI workflow for property:', input.propertyId);

      let workflowStarted = false;
      let workflowStatus;

      try {
        const status = await this.orchestrator.startPropertyWorkflow(updatedProperty);

        workflowStarted = true;
        workflowStatus = {
          currentStage: status.currentStage,
          humanInterventionRequired: status.humanInterventionRequired || false,
        };

        console.log('[PublishProperty] AI workflow started successfully', {
          propertyId: input.propertyId,
          currentStage: status.currentStage,
          humanInterventionRequired: status.humanInterventionRequired,
        });
      } catch (workflowError) {
        console.error('[PublishProperty] AI workflow failed to start:', workflowError);
        // Don't fail the entire publish if workflow fails
        // Property is still published, workflow can be retried later
        workflowStarted = false;
      }

      return {
        property: updatedProperty,
        success: true,
        message: workflowStarted
          ? 'Property published and AI workflow started successfully'
          : 'Property published (AI workflow will be retried)',
        workflowStarted,
        workflowStatus,
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

