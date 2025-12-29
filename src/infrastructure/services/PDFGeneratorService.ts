/**
 * PDF Generator Service
 * Generates legal documents (contracts, disclosures, checklists) from Handlebars templates using Puppeteer
 *
 * IMPORTANT: This service should ONLY run on the server (API routes, server actions)
 */

import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { supabaseAdmin } from '../database/supabase/client';

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
   * Generate PDF from Handlebars template using Puppeteer
   */
  async generatePDF(
    templateName: string,
    data: Record<string, any>,
    userId: string
  ): Promise<PDFGenerationResult> {
    let browser;

    try {
      // 1. Load and compile Handlebars template
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);

      // 2. Render template with data to HTML
      const html = template(data);

      // 3. Generate PDF from HTML using Puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'LETTER',
        printBackground: true,
        margin: {
          top: '50px',
          bottom: '50px',
          left: '50px',
          right: '50px',
        },
      });

      await browser.close();

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

      const publicUrl = signedUrlData?.signedUrl || `https://storage.example.com/${filePath}`;

      return {
        success: true,
        documentId,
        documentUrl: uploadData.path,
        publicUrl,
        filePath,
      };
    } catch (error) {
      if (browser) {
        await browser.close();
      }

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
      seller: { name: 'John Seller' },
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
      property: { address: 'Property Address' },
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
      property: { address: 'Property Address' },
      transaction: transactionData,
      generatedAt: new Date().toISOString(),
      documentId: `closing_${propertyId}_${Date.now()}`,
    };

    return this.generatePDF('closing-checklist-template', data, userId);
  }
}

// Singleton instance
export const pdfGeneratorService = new PDFGeneratorService();
