/**
 * PDF Generator Service
 * Generates legal documents (contracts, disclosures, checklists) from Handlebars templates
 *
 * IMPORTANT: This service should ONLY run on the server (API routes, server actions)
 * PDFKit has issues with Next.js bundlers (webpack/turbopack) in client code
 */

// Dynamic import to ensure server-only execution
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../database/supabase/client';

// Lazy load PDFKit to avoid bundler issues
let PDFDocument: any;
const loadPDFKit = async () => {
  if (!PDFDocument) {
    PDFDocument = (await import('pdfkit')).default;
  }
  return PDFDocument;
};

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a: any, b: any) {
  return a === b;
});

Handlebars.registerHelper('lt', function (a: any, b: any) {
  return a < b;
});

Handlebars.registerHelper('includes', function (array: any[], value: any) {
  return array && array.includes(value);
});

export interface PDFGenerationResult {
  success: boolean;
  documentId: string;
  documentUrl: string;
  publicUrl: string;
  filePath: string;
  error?: string;
}

export class PDFGeneratorService {
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(process.cwd(), 'src', 'infrastructure', 'ai', 'templates');
  }

  /**
   * Generate PDF from template
   */
  async generatePDF(
    templateName: string,
    data: Record<string, any>,
    userId: string
  ): Promise<PDFGenerationResult> {
    try {
      // 1. Load template
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);

      // 2. Render template with data
      const renderedContent = template(data);

      // 3. Create PDF
      const pdfBuffer = await this.createPDFFromText(renderedContent);

      // 4. Upload to Supabase Storage
      const documentId = `${templateName}_${Date.now()}`;
      const filePath = `${userId}/documents/${documentId}.pdf`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('legal-documents')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // 5. Get public URL (signed URL for private bucket)
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
        .from('legal-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days expiry

      if (signedUrlError) {
        console.error('[PDFGeneratorService] Failed to create signed URL:', signedUrlError);
      }

      const publicUrl = signedUrlData?.signedUrl || `https://storage.example.com/${filePath}`; // Fallback mock URL for testing

      return {
        success: true,
        documentId,
        documentUrl: uploadData.path,
        publicUrl,
        filePath,
      };
    } catch (error) {
      console.error('[PDFGeneratorService] Error generating PDF:', error);
      return {
        success: false,
        documentId: '',
        documentUrl: '',
        publicUrl: '',
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create PDF buffer from plain text
   */
  private async createPDFFromText(text: string): Promise<Buffer> {
    // Load PDFKit dynamically to avoid bundler issues
    const PDFDoc = await loadPDFKit();

    return new Promise((resolve, reject) => {
      // Use Helvetica (standard PDF font, no external .afm files needed)
      const doc = new PDFDoc({
        size: 'LETTER',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add content - Helvetica is built into PDF spec, no .afm files needed
      doc.fontSize(12);
      doc.font('Helvetica');

      // Split text into lines and add to PDF
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        // Handle headers (lines with = or - underlines)
        if (line.match(/^=+$/) || line.match(/^-+$/)) {
          return; // Skip underline characters
        }

        // Check if previous line was a header
        const prevLine = lines[index - 1];
        const nextLine = lines[index + 1];
        const isHeader = nextLine && (nextLine.match(/^=+$/) || nextLine.match(/^-+$/));

        if (isHeader) {
          doc.fontSize(16).font('Courier-Bold');
          doc.text(line, { align: 'left' });
          doc.moveDown(0.5);
          doc.fontSize(12).font('Courier');
        } else {
          // Check for bold patterns (checkbox items, labels, etc.)
          if (line.match(/^\[.*\]/) || line.match(/^[A-Z\s]+:$/)) {
            doc.font('Courier-Bold');
            doc.text(line);
            doc.font('Courier');
          } else {
            doc.text(line);
          }
        }

        // Add extra spacing after sections
        if (line.trim() === '') {
          doc.moveDown(0.5);
        }
      });

      doc.end();
    });
  }

  /**
   * Generate Contract PDF
   */
  async generateContract(
    propertyId: string,
    propertyData: any,
    offerData: any,
    userId: string
  ): Promise<PDFGenerationResult> {
    const data = {
      property: propertyData,
      offer: offerData,
      seller: { name: 'John Seller' }, // TODO: Get from user data
      buyer: { name: offerData.buyerName, email: offerData.buyerEmail },
      payment: {
        downPayment: Math.round(offerData.offerAmount * 0.2),
        financing: 'Conventional',
        earnestMoney: Math.round(offerData.offerAmount * 0.01),
      },
      contractDate: new Date().toLocaleDateString(),
      generatedAt: new Date().toISOString(),
      documentId: `contract_${propertyId}_${Date.now()}`,
    };

    return this.generatePDF('contract-template', data, userId);
  }

  /**
   * Generate Disclosure PDF
   */
  async generateDisclosure(
    propertyId: string,
    propertyData: any,
    disclosureType: string,
    knownIssues: any,
    userId: string
  ): Promise<PDFGenerationResult> {
    const data = {
      property: propertyData,
      disclosureType,
      knownIssues: knownIssues || {},
      leadPaint: {
        presence: 'Unknown',
        location: 'N/A',
        records: 'No records available',
      },
      disclosureDate: new Date().toLocaleDateString(),
      generatedAt: new Date().toISOString(),
      documentId: `disclosure_${disclosureType}_${propertyId}_${Date.now()}`,
    };

    return this.generatePDF('disclosure-template', data, userId);
  }

  /**
   * Generate Inspection Checklist PDF
   */
  async generateInspectionChecklist(
    propertyId: string,
    propertyType: string,
    includeAreas: string[],
    userId: string
  ): Promise<PDFGenerationResult> {
    const data = {
      property: { address: 'Property Address' }, // TODO: Get from property data
      propertyType,
      includeAreas,
      inspectionDate: new Date().toLocaleDateString(),
      generatedAt: new Date().toISOString(),
      documentId: `inspection_${propertyId}_${Date.now()}`,
    };

    return this.generatePDF('inspection-checklist-template', data, userId);
  }

  /**
   * Generate Closing Checklist PDF
   */
  async generateClosingChecklist(
    propertyId: string,
    transactionData: any,
    userId: string
  ): Promise<PDFGenerationResult> {
    const data = {
      property: { address: 'Property Address' }, // TODO: Get from property data
      transaction: transactionData,
      generatedAt: new Date().toISOString(),
      documentId: `closing_${propertyId}_${Date.now()}`,
    };

    return this.generatePDF('closing-checklist-template', data, userId);
  }
}

// Singleton instance
export const pdfGeneratorService = new PDFGeneratorService();
