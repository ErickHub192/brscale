/**
 * All AI Agent Tools
 * Combines custom business logic tools with MCP-based service tools
 */

import { DynamicStructuredTool } from '@langchain/core/tools';

// Custom business logic tools
import { CUSTOM_BUSINESS_TOOLS } from './index';

// MCP-based service tools
import { CALENDAR_TOOLS } from './calendar';
import { MESSAGING_TOOLS } from './messaging';
import { DOCUMENT_TOOLS } from './document';

/**
 * All available tools for AI agents
 */
export const ALL_TOOLS: DynamicStructuredTool[] = [
  ...CUSTOM_BUSINESS_TOOLS, // Property, Market, Lead, Offer analysis
  ...CALENDAR_TOOLS, // Google Calendar scheduling
  ...MESSAGING_TOOLS, // WhatsApp, Email, SMS
  ...DOCUMENT_TOOLS, // PDF generation, contracts
];

/**
 * Tool categories for selective loading
 */
export const TOOL_CATEGORIES = {
  // Input Manager Agent tools
  INPUT_MANAGER: [
    CUSTOM_BUSINESS_TOOLS[0], // PropertyAnalysisTool
    CUSTOM_BUSINESS_TOOLS[1], // MarketDataTool
  ],

  // Marketing Agent tools
  MARKETING: [
    MESSAGING_TOOLS[1], // SendEmailTool
    MESSAGING_TOOLS[0], // SendWhatsAppTool
  ],

  // Lead Manager Agent tools
  LEAD_MANAGER: [
    CUSTOM_BUSINESS_TOOLS[2], // LeadQualificationTool
    CALENDAR_TOOLS[0], // ScheduleVisitTool
    CALENDAR_TOOLS[1], // CheckAvailabilityTool
    MESSAGING_TOOLS[0], // SendWhatsAppTool
    MESSAGING_TOOLS[1], // SendEmailTool
    MESSAGING_TOOLS[2], // SendSMSTool
    MESSAGING_TOOLS[3], // SendFollowUpSequenceTool
  ],

  // Negotiation Agent tools
  NEGOTIATION: [
    CUSTOM_BUSINESS_TOOLS[3], // OfferAnalysisTool
    CUSTOM_BUSINESS_TOOLS[1], // MarketDataTool
    MESSAGING_TOOLS[0], // SendWhatsAppTool
    MESSAGING_TOOLS[1], // SendEmailTool
  ],

  // Legal Agent tools
  LEGAL: [
    DOCUMENT_TOOLS[0], // GenerateContractTool
    DOCUMENT_TOOLS[1], // GenerateDisclosureTool
    DOCUMENT_TOOLS[2], // GenerateInspectionChecklistTool
    DOCUMENT_TOOLS[3], // GenerateClosingChecklistTool
  ],

  // Closure Agent tools (human-supervised)
  CLOSURE: [
    DOCUMENT_TOOLS[0], // GenerateContractTool
    MESSAGING_TOOLS[1], // SendEmailTool
  ],
};

/**
 * Get tools by category
 */
export function getToolsByCategory(category: keyof typeof TOOL_CATEGORIES): DynamicStructuredTool[] {
  return TOOL_CATEGORIES[category] || [];
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): DynamicStructuredTool | undefined {
  return ALL_TOOLS.find((tool) => tool.name === name);
}
