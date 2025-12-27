/**
 * Document Generation Tools (PDF, Contracts, Checklists)
 * Uses PDFGeneratorService to create real PDFs from templates
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { pdfGeneratorService } from '@/infrastructure/services/PDFGeneratorService';

/**
 * Generate Contract Tool
 * Generates a real estate purchase contract from template
 */
export const GenerateContractTool = new DynamicStructuredTool({
  name: 'generate_contract',
  description:
    'Generates a real estate purchase contract PDF from template with property and offer details filled in.',
  schema: z.object({
    propertyId: z.string().describe('Property ID'),
    propertyData: z.object({
      address: z.string(),
      price: z.number(),
      sellerName: z.string(),
    }),
    offerData: z.object({
      buyerName: z.string(),
      buyerEmail: z.string(),
      offerAmount: z.number(),
      conditions: z.array(z.string()),
      closingDate: z.string(),
    }),
    templateType: z
      .enum(['standard', 'as_is', 'contingent'])
      .optional()
      .default('standard')
      .describe('Contract template type'),
  }),
  func: async ({ propertyId, propertyData, offerData, templateType }) => {
    console.log('[GenerateContractTool] Generating contract:', {
      propertyId,
      templateType,
      buyerName: offerData.buyerName,
    });

    // Generate real PDF using PDFGeneratorService
    const userId = 'system'; // TODO: Get actual userId from context
    const result = await pdfGeneratorService.generateContract(
      propertyId,
      propertyData,
      offerData,
      userId
    );

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Failed to generate contract PDF',
      });
    }

    const contract = {
      documentId: result.documentId,
      documentUrl: result.publicUrl,
      storagePath: result.documentUrl,
      documentType: 'purchase_contract',
      templateType,
      property: propertyData,
      buyer: {
        name: offerData.buyerName,
        email: offerData.buyerEmail,
      },
      purchasePrice: offerData.offerAmount,
      closingDate: offerData.closingDate,
      conditions: offerData.conditions,
      generatedAt: new Date().toISOString(),
      status: 'draft',
      requiresReview: true,
    };

    return JSON.stringify({
      success: true,
      documentId: result.documentId,
      documentUrl: result.publicUrl,
      contract,
      message: 'Contract PDF generated successfully. Requires legal review before signing.',
    });
  },
});

/**
 * Generate Disclosure Documents Tool
 * Generates property disclosure documents
 */
export const GenerateDisclosureTool = new DynamicStructuredTool({
  name: 'generate_disclosure',
  description:
    'Generates property disclosure documents (lead paint, mold, structural issues, etc.)',
  schema: z.object({
    propertyId: z.string().describe('Property ID'),
    propertyData: z.object({
      address: z.string(),
      yearBuilt: z.number(),
      propertyType: z.string(),
    }),
    disclosureType: z
      .enum(['lead_paint', 'mold', 'structural', 'environmental', 'full'])
      .describe('Type of disclosure document'),
    knownIssues: z.array(z.string()).optional().describe('Known issues to disclose'),
  }),
  func: async ({ propertyId, propertyData, disclosureType, knownIssues = [] }) => {
    console.log('[GenerateDisclosureTool] Generating disclosure:', {
      propertyId,
      disclosureType,
      issueCount: knownIssues.length,
    });

    // Generate real PDF using PDFGeneratorService
    const userId = 'system'; // TODO: Get actual userId from context
    const result = await pdfGeneratorService.generateDisclosure(
      propertyId,
      propertyData,
      disclosureType,
      knownIssues,
      userId
    );

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Failed to generate disclosure PDF',
      });
    }

    return JSON.stringify({
      success: true,
      documentId: result.documentId,
      documentUrl: result.publicUrl,
      storagePath: result.documentUrl,
      disclosureType,
      property: propertyData,
      knownIssues,
      generatedAt: new Date().toISOString(),
      status: 'draft',
      message: 'Disclosure PDF generated successfully.',
    });
  },
});

/**
 * Generate Inspection Checklist Tool
 * Generates a property inspection checklist
 */
export const GenerateInspectionChecklistTool = new DynamicStructuredTool({
  name: 'generate_inspection_checklist',
  description:
    'Generates a comprehensive property inspection checklist for buyers and inspectors.',
  schema: z.object({
    propertyId: z.string().describe('Property ID'),
    propertyType: z.string().describe('Property type (house, apartment, etc.)'),
    includeAreas: z
      .array(
        z.enum([
          'foundation',
          'roof',
          'plumbing',
          'electrical',
          'hvac',
          'interior',
          'exterior',
          'appliances',
        ])
      )
      .optional()
      .describe('Areas to include in checklist'),
  }),
  func: async ({ propertyId, propertyType, includeAreas }) => {
    console.log('[GenerateInspectionChecklistTool] Generating checklist:', {
      propertyId,
      propertyType,
      areas: includeAreas?.length || 'all',
    });

    // Generate real PDF using PDFGeneratorService
    const userId = 'system'; // TODO: Get actual userId from context
    const areas = includeAreas || [
      'foundation',
      'roof',
      'plumbing',
      'electrical',
      'hvac',
      'interior',
      'exterior',
      'appliances',
    ];

    const result = await pdfGeneratorService.generateInspectionChecklist(
      propertyId,
      propertyType,
      areas,
      userId
    );

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Failed to generate inspection checklist PDF',
      });
    }

    return JSON.stringify({
      success: true,
      documentId: result.documentId,
      documentUrl: result.publicUrl,
      storagePath: result.documentUrl,
      propertyType,
      totalAreas: areas.length,
      generatedAt: new Date().toISOString(),
      message: 'Inspection checklist PDF generated successfully.',
    });
  },
});

/**
 * Generate Closing Checklist Tool
 * Generates a closing checklist for the transaction
 */
export const GenerateClosingChecklistTool = new DynamicStructuredTool({
  name: 'generate_closing_checklist',
  description:
    'Generates a comprehensive closing checklist with all required documents and steps for closing the transaction.',
  schema: z.object({
    propertyId: z.string().describe('Property ID'),
    transactionData: z.object({
      buyerName: z.string(),
      sellerName: z.string(),
      closingDate: z.string(),
      purchasePrice: z.number(),
    }),
  }),
  func: async ({ propertyId, transactionData }) => {
    console.log('[GenerateClosingChecklistTool] Generating closing checklist:', {
      propertyId,
      closingDate: transactionData.closingDate,
    });

    // Generate real PDF using PDFGeneratorService
    const userId = 'system'; // TODO: Get actual userId from context
    const result = await pdfGeneratorService.generateClosingChecklist(
      propertyId,
      transactionData,
      userId
    );

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Failed to generate closing checklist PDF',
      });
    }

    return JSON.stringify({
      success: true,
      documentId: result.documentId,
      documentUrl: result.publicUrl,
      storagePath: result.documentUrl,
      transaction: transactionData,
      generatedAt: new Date().toISOString(),
      message: 'Closing checklist PDF generated successfully.',
    });
  },
});

/**
 * Export all document tools
 */
export const DOCUMENT_TOOLS = [
  GenerateContractTool,
  GenerateDisclosureTool,
  GenerateInspectionChecklistTool,
  GenerateClosingChecklistTool,
];
