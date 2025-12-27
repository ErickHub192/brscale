/**
 * Custom AI Agent Tools for Real Estate Business Logic
 * Domain-specific tools for property analysis, market data, lead qualification, and offer analysis
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Property Analysis Tool
 * Analyzes property data and provides insights
 */
export const PropertyAnalysisTool = new DynamicStructuredTool({
  name: 'analyze_property',
  description:
    'Analyzes property data to validate completeness, identify missing information, and provide quality score. Returns suggestions for improvement.',
  schema: z.object({
    propertyId: z.string().describe('The property ID to analyze'),
    propertyData: z.object({
      title: z.string(),
      description: z.string(),
      price: z.number(),
      bedrooms: z.number(),
      bathrooms: z.number(),
      squareFeet: z.number(),
      images: z.array(z.string()),
      videos: z.array(z.string()).optional(),
      address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
      }),
    }),
  }),
  func: async ({ propertyId, propertyData }) => {
    // Property completeness analysis
    let completeness = 0;
    const missingFields: string[] = [];
    const suggestions: string[] = [];

    // Required fields check
    if (propertyData.title && propertyData.title.length > 10) completeness += 15;
    else missingFields.push('title');

    if (propertyData.description && propertyData.description.length > 50) completeness += 20;
    else {
      missingFields.push('description');
      suggestions.push('Add a detailed description (at least 100 words)');
    }

    if (propertyData.price > 0) completeness += 15;
    else missingFields.push('price');

    if (propertyData.images && propertyData.images.length >= 5) completeness += 25;
    else {
      suggestions.push(`Add more images (current: ${propertyData.images?.length || 0}, recommended: 10+)`);
    }

    if (propertyData.videos && propertyData.videos.length > 0) completeness += 15;
    else {
      suggestions.push('Add a video tour to increase engagement');
    }

    completeness += 10; // Base details provided

    // Quality score based on details
    let qualityScore = completeness;
    if (propertyData.squareFeet > 0) qualityScore += 5;
    if (propertyData.bedrooms > 0 && propertyData.bathrooms > 0) qualityScore += 5;

    return JSON.stringify({
      propertyId,
      completeness: Math.min(completeness, 100),
      qualityScore: Math.min(qualityScore, 100),
      missingFields,
      suggestions,
      readyToPublish: completeness >= 85,
      message:
        completeness >= 85
          ? 'Property looks great! Ready to publish.'
          : 'Property needs improvements before publishing.',
    });
  },
});

/**
 * Market Data Tool
 * Fetches comparable property data from the market
 */
export const MarketDataTool = new DynamicStructuredTool({
  name: 'fetch_market_data',
  description:
    'Fetches comparable property sales data and market trends for pricing analysis. Returns avg price, market trend, and comparable properties.',
  schema: z.object({
    propertyType: z.string().describe('Type of property (house, apartment, etc.)'),
    location: z.object({
      city: z.string(),
      state: z.string(),
      zipCode: z.string().optional(),
    }),
    bedrooms: z.number().optional().describe('Number of bedrooms'),
    bathrooms: z.number().optional().describe('Number of bathrooms'),
    squareFeet: z.number().optional().describe('Square footage'),
    priceRange: z
      .object({
        min: z.number(),
        max: z.number(),
      })
      .optional()
      .describe('Price range for comparables'),
  }),
  func: async ({ propertyType, location, bedrooms, bathrooms, squareFeet, priceRange }) => {
    // TODO: Integrate with real market data API (Zillow, Realtor.com, etc.)
    console.log('[MarketDataTool] Fetching market data:', {
      propertyType,
      location,
      bedrooms,
      bathrooms,
    });

    // Mock market data
    const basePrice = priceRange ? (priceRange.min + priceRange.max) / 2 : 350000;
    const pricePerSqft = squareFeet ? basePrice / squareFeet : 175;

    const comparables = [
      {
        address: `${location.city}, ${location.state}`,
        price: basePrice * 0.95,
        bedrooms: bedrooms || 3,
        bathrooms: bathrooms || 2,
        squareFeet: squareFeet || 2000,
        soldDate: '2024-11-15',
        daysOnMarket: 28,
      },
      {
        address: `${location.city}, ${location.state}`,
        price: basePrice * 1.05,
        bedrooms: bedrooms || 3,
        bathrooms: bathrooms || 2,
        squareFeet: squareFeet ? squareFeet * 1.1 : 2200,
        soldDate: '2024-10-22',
        daysOnMarket: 35,
      },
      {
        address: `${location.city}, ${location.state}`,
        price: basePrice,
        bedrooms: bedrooms || 3,
        bathrooms: bathrooms || 2,
        squareFeet: squareFeet || 2000,
        soldDate: '2024-12-01',
        daysOnMarket: 21,
      },
    ];

    const averagePrice = comparables.reduce((sum, c) => sum + c.price, 0) / comparables.length;
    const averageDaysOnMarket =
      comparables.reduce((sum, c) => sum + c.daysOnMarket, 0) / comparables.length;

    // Determine market trend
    let marketTrend: 'hot' | 'stable' | 'cooling' = 'stable';
    if (averageDaysOnMarket < 30) marketTrend = 'hot';
    else if (averageDaysOnMarket > 60) marketTrend = 'cooling';

    return JSON.stringify({
      location: `${location.city}, ${location.state}`,
      propertyType,
      comparables,
      averagePrice: Math.round(averagePrice),
      pricePerSqft: Math.round(pricePerSqft),
      averageDaysOnMarket: Math.round(averageDaysOnMarket),
      marketTrend,
      totalComparables: comparables.length,
      message: `Found ${comparables.length} comparable properties. Market is ${marketTrend}.`,
    });
  },
});

/**
 * Lead Qualification Tool
 * Scores and qualifies leads based on multiple criteria
 */
export const LeadQualificationTool = new DynamicStructuredTool({
  name: 'qualify_lead',
  description:
    'Analyzes and scores a lead based on qualification criteria. Returns score, status, and recommendations.',
  schema: z.object({
    leadData: z.object({
      name: z.string(),
      email: z.string(),
      phone: z.string().optional(),
      source: z.enum(['whatsapp', 'email', 'web', 'referral']),
      message: z.string().optional(),
      budget: z.number().optional(),
      timeline: z.string().optional().describe('When they want to buy (e.g., "immediately", "3 months")'),
      preApproved: z.boolean().optional().describe('Whether they have mortgage pre-approval'),
    }),
    propertyPrice: z.number().describe('Property price for comparison'),
  }),
  func: async ({ leadData, propertyPrice }) => {
    let score = 30; // Base score
    const qualificationFactors: string[] = [];

    // Contact information completeness (0-20 points)
    if (leadData.phone) {
      score += 15;
      qualificationFactors.push('Has phone number');
    }
    if (leadData.email) {
      score += 5;
      qualificationFactors.push('Has email');
    }

    // Budget alignment (0-30 points)
    if (leadData.budget) {
      if (leadData.budget >= propertyPrice) {
        score += 30;
        qualificationFactors.push('Budget exceeds asking price');
      } else if (leadData.budget >= propertyPrice * 0.9) {
        score += 25;
        qualificationFactors.push('Budget within 10% of asking price');
      } else if (leadData.budget >= propertyPrice * 0.75) {
        score += 15;
        qualificationFactors.push('Budget within 25% of asking price');
      } else {
        qualificationFactors.push('Budget significantly below asking price');
      }
    }

    // Pre-approval status (0-20 points)
    if (leadData.preApproved) {
      score += 20;
      qualificationFactors.push('Has mortgage pre-approval');
    }

    // Timeline urgency (0-15 points)
    if (leadData.timeline) {
      const timeline = leadData.timeline.toLowerCase();
      if (timeline.includes('immediate') || timeline.includes('asap')) {
        score += 15;
        qualificationFactors.push('Immediate timeline');
      } else if (timeline.includes('month') || timeline.includes('weeks')) {
        score += 10;
        qualificationFactors.push('Near-term timeline');
      } else {
        score += 5;
        qualificationFactors.push('Flexible timeline');
      }
    }

    // Message quality and engagement (0-15 points)
    if (leadData.message) {
      if (leadData.message.length > 100) {
        score += 15;
        qualificationFactors.push('Detailed inquiry');
      } else if (leadData.message.length > 50) {
        score += 10;
        qualificationFactors.push('Good engagement');
      } else {
        score += 5;
        qualificationFactors.push('Basic inquiry');
      }
    }

    // Determine status
    let status: 'hot' | 'qualified' | 'needs_nurturing' | 'cold';
    let recommendation: string;

    if (score >= 85) {
      status = 'hot';
      recommendation = 'HIGH PRIORITY: Schedule visit immediately. This lead is highly qualified.';
    } else if (score >= 70) {
      status = 'qualified';
      recommendation = 'Schedule visit within 24 hours. Strong potential buyer.';
    } else if (score >= 50) {
      status = 'needs_nurturing';
      recommendation = 'Send detailed property information and follow up in 2-3 days.';
    } else {
      status = 'cold';
      recommendation = 'Add to nurture campaign. Low priority for immediate follow-up.';
    }

    return JSON.stringify({
      leadName: leadData.name,
      qualificationScore: Math.min(score, 100),
      status,
      qualificationFactors,
      recommendation,
      budgetAlignment: leadData.budget
        ? `${Math.round((leadData.budget / propertyPrice) * 100)}%`
        : 'Unknown',
      nextSteps:
        status === 'hot' || status === 'qualified'
          ? ['Call lead immediately', 'Schedule property visit', 'Send property details']
          : ['Send automated follow-up', 'Add to nurture sequence', 'Monitor engagement'],
    });
  },
});

/**
 * Offer Analysis Tool
 * Analyzes offers and suggests counter-offer strategies
 */
export const OfferAnalysisTool = new DynamicStructuredTool({
  name: 'analyze_offer',
  description:
    'Analyzes a purchase offer and provides strategic recommendations. Returns recommendation, counter-offer suggestion, and reasoning.',
  schema: z.object({
    offerAmount: z.number().describe('Offer amount in dollars'),
    askingPrice: z.number().describe('Property asking price'),
    conditions: z.array(z.string()).describe('Offer conditions (inspection, financing, etc.)'),
    earnestMoney: z.number().optional().describe('Earnest money deposit amount'),
    closingDate: z.string().optional().describe('Proposed closing date'),
    marketData: z
      .object({
        averagePrice: z.number(),
        daysOnMarket: z.number(),
        marketTrend: z.enum(['hot', 'stable', 'cooling']),
      })
      .optional()
      .describe('Current market conditions'),
  }),
  func: async ({
    offerAmount,
    askingPrice,
    conditions,
    earnestMoney,
    closingDate,
    marketData,
  }) => {
    const percentage = (offerAmount / askingPrice) * 100;
    const factors: string[] = [];

    // Analyze offer percentage
    let baseRecommendation: 'accept' | 'counter_offer' | 'reject' | 'negotiate';

    if (percentage >= 98) {
      baseRecommendation = 'accept';
      factors.push('Offer is at or above asking price');
    } else if (percentage >= 95) {
      baseRecommendation = 'accept';
      factors.push('Offer is within 5% of asking price');
    } else if (percentage >= 90) {
      baseRecommendation = 'counter_offer';
      factors.push('Offer is within 10% of asking price');
    } else if (percentage >= 85) {
      baseRecommendation = 'counter_offer';
      factors.push('Offer is 10-15% below asking price');
    } else {
      baseRecommendation = 'reject';
      factors.push('Offer is significantly below asking price');
    }

    // Adjust based on market conditions
    if (marketData) {
      if (marketData.marketTrend === 'hot' && percentage < 95) {
        baseRecommendation = 'reject';
        factors.push('Hot market - can get better offers');
      } else if (marketData.marketTrend === 'cooling' && percentage >= 90) {
        if (baseRecommendation === 'counter_offer') baseRecommendation = 'accept';
        factors.push('Cooling market - good offer to consider');
      }

      if (marketData.daysOnMarket > 60 && percentage >= 90) {
        baseRecommendation = 'accept';
        factors.push('Property has been on market long - strong offer');
      }
    }

    // Analyze conditions
    const hasInspectionContingency = conditions.some((c) =>
      c.toLowerCase().includes('inspection')
    );
    const hasFinancingContingency = conditions.some((c) =>
      c.toLowerCase().includes('financing')
    );

    if (hasInspectionContingency) factors.push('Inspection contingency included');
    if (hasFinancingContingency) factors.push('Financing contingency included');
    if (conditions.length > 3) {
      factors.push('Multiple contingencies - may slow closing');
    }

    // Earnest money analysis
    const typicalEarnest = askingPrice * 0.01; // 1% is typical
    if (earnestMoney && earnestMoney >= typicalEarnest * 2) {
      factors.push('Strong earnest money deposit - serious buyer');
    }

    // Calculate suggested counter-offer
    let suggestedCounter: number | null = null;
    if (baseRecommendation === 'counter_offer') {
      if (percentage >= 90) {
        suggestedCounter = askingPrice * 0.97; // Counter at 97%
      } else {
        suggestedCounter = askingPrice * 0.94; // Counter at 94%
      }
    }

    // Generate reasoning
    let reasoning = '';
    if (baseRecommendation === 'accept') {
      reasoning = `Offer at ${percentage.toFixed(1)}% of asking price is strong. ${factors.join('. ')}.`;
    } else if (baseRecommendation === 'counter_offer') {
      reasoning = `Offer at ${percentage.toFixed(1)}% is reasonable but room for negotiation. Suggest counter-offer at $${suggestedCounter?.toLocaleString()}. ${factors.join('. ')}.`;
    } else {
      reasoning = `Offer at ${percentage.toFixed(1)}% is too low. ${factors.join('. ')}. Wait for better offers or reject.`;
    }

    return JSON.stringify({
      offerPercentage: percentage.toFixed(2),
      recommendation: baseRecommendation,
      suggestedCounterOffer: suggestedCounter,
      factors,
      reasoning,
      offerStrength: percentage >= 95 ? 'strong' : percentage >= 90 ? 'moderate' : 'weak',
      riskLevel:
        conditions.length > 3 ? 'high' : conditions.length > 1 ? 'medium' : 'low',
    });
  },
});

/**
 * Export all custom tools
 */
export const CUSTOM_BUSINESS_TOOLS = [
  PropertyAnalysisTool,
  MarketDataTool,
  LeadQualificationTool,
  OfferAnalysisTool,
];
