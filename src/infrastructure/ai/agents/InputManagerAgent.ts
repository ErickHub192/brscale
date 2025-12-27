/**
 * Input Manager Agent
 * Validates property data, enhances descriptions, and suggests pricing
 */

import { BaseAgent, AgentConfig } from './BaseAgent';
import { PropertyWorkflowStateType } from '../types/WorkflowState';
import { TOOL_CATEGORIES } from '../tools/allTools';
import { AI_CONFIG } from '@/infrastructure/config/env';

export class InputManagerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Input Manager',
      description:
        'Validates property data completeness, enhances descriptions with AI, and suggests optimal pricing based on market data',
      tools: TOOL_CATEGORIES.INPUT_MANAGER,
      temperature: AI_CONFIG.temperature.precise, // 0.3 for data validation
      maxTokens: AI_CONFIG.maxTokens.medium, // 1500 tokens
      systemPrompt: `You are the Input Manager Agent for BR SCALE real estate platform.

Your responsibilities:
1. **Validate Property Data**: Check that all required fields are complete and accurate
2. **Analyze Quality**: Score the property listing quality (0-100)
3. **Enhance Description**: Improve the property description to be more compelling and SEO-friendly
4. **Suggest Pricing**: Use market data to validate or suggest optimal pricing

Tools available:
- analyze_property: Validate completeness and quality
- fetch_market_data: Get comparable properties and market trends

Process:
1. Use analyze_property tool to check data completeness
2. If pricing needs validation, use fetch_market_data tool
3. Provide clear recommendations for improvements
4. If quality score >= 85%, approve for marketing stage
5. If quality score < 85%, list specific improvements needed

Return a structured JSON response with:
- validationPassed: boolean
- qualityScore: number (0-100)
- suggestions: string[] (what needs improvement)
- enhancedDescription: string (AI-improved description)
- suggestedPrice: number | null (if price adjustment recommended)
- readyForMarketing: boolean`,
    };

    super(config);
  }

  async execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType>> {
    this.log('Starting property validation and enhancement');

    try {
      const { property, propertyId } = state;

      if (!property) {
        throw new Error('Property data not found in state');
      }

      // Step 1: Analyze property completeness
      this.log('Analyzing property data completeness');
      const analysisTool = this.config.tools.find((t) => t.name === 'analyze_property');

      if (!analysisTool) {
        throw new Error('analyze_property tool not found');
      }

      const analysisResult = await analysisTool.func({
        propertyId,
        propertyData: {
          title: property.title,
          description: property.description,
          price: property.price,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          squareFeet: property.squareFeet,
          images: property.images,
          videos: property.videos || [],
          address: property.address,
        },
      });

      const analysis = JSON.parse(analysisResult);
      this.log('Property analysis complete', {
        completeness: analysis.completeness,
        qualityScore: analysis.qualityScore,
      });

      // Step 2: Fetch market data for pricing validation
      this.log('Fetching market data for pricing validation');
      const marketTool = this.config.tools.find((t) => t.name === 'fetch_market_data');

      if (!marketTool) {
        throw new Error('fetch_market_data tool not found');
      }

      const marketResult = await marketTool.func({
        propertyType: property.propertyType,
        location: {
          city: property.address.city,
          state: property.address.state,
          zipCode: property.address.zipCode,
        },
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: property.squareFeet,
        priceRange: {
          min: property.price * 0.8,
          max: property.price * 1.2,
        },
      });

      const marketData = JSON.parse(marketResult);
      this.log('Market data fetched', {
        averagePrice: marketData.averagePrice,
        marketTrend: marketData.marketTrend,
      });

      // Step 3: Determine if pricing is optimal
      const priceDifference = Math.abs(property.price - marketData.averagePrice);
      const priceVariance = (priceDifference / marketData.averagePrice) * 100;

      let suggestedPrice: number | null = null;
      if (priceVariance > 10) {
        // Price differs by more than 10% from market average
        suggestedPrice = Math.round(marketData.averagePrice);
        this.log('Price adjustment recommended', {
          current: property.price,
          suggested: suggestedPrice,
          variance: `${priceVariance.toFixed(1)}%`,
        });
      }

      // Step 4: Enhanced description (simple for now, can be improved with LLM)
      const enhancedDescription = `${property.description}\n\n✨ This ${property.propertyType} features ${property.bedrooms} bedrooms and ${property.bathrooms} bathrooms across ${property.squareFeet} sq ft. Located in ${property.address.city}, ${property.address.state}. ${marketData.marketTrend === 'hot' ? '🔥 High demand area!' : marketData.marketTrend === 'cooling' ? '💰 Great opportunity!' : '✅ Stable market.'}`;

      // Step 5: Check if human has provided override
      let readyForMarketing = false;
      const validationPassed = analysis.completeness >= 70;
      const qualityCheckPassed = analysis.qualityScore >= 85 && validationPassed;

      // If human response exists, use LLM to interpret it
      if (state.humanResponse) {
        const context = `Property validation completed with quality score ${analysis.qualityScore}/100 (threshold: 85). Suggestions: ${analysis.suggestions.join(', ')}`;
        const decision = await this.interpretHumanResponse(
          state.humanResponse,
          context,
          ['PROCEED', 'STAY']
        );

        // Strategy Pattern: Map decisions to actions
        const decisionActions: Record<string, () => boolean> = {
          PROCEED: () => true,
          STAY: () => false,
        };

        const action = decisionActions[decision];
        readyForMarketing = action ? action() : qualityCheckPassed;
      } else {
        // No human response, use automatic validation
        readyForMarketing = qualityCheckPassed;
      }

      // Create agent output
      const agentOutput = {
        validationPassed,
        qualityScore: analysis.qualityScore,
        completeness: analysis.completeness,
        suggestions: analysis.suggestions,
        missingFields: analysis.missingFields,
        enhancedDescription,
        suggestedPrice,
        marketData: {
          averagePrice: marketData.averagePrice,
          pricePerSqft: marketData.pricePerSqft,
          marketTrend: marketData.marketTrend,
          comparables: marketData.totalComparables,
        },
        readyForMarketing,
      };

      this.log('Input validation complete', {
        readyForMarketing,
        qualityScore: analysis.qualityScore,
      });

      // Update state
      return {
        stage: readyForMarketing ? 'marketing' : 'input_validation',
        humanInterventionRequired: !readyForMarketing,
        agentOutputs: {
          ...state.agentOutputs,
          input_manager: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: true,
            data: agentOutput,
            nextAction: readyForMarketing
              ? 'Proceed to Marketing Agent'
              : 'Fix missing fields and re-validate',
          },
        },
        property: {
          ...property,
          aiEnhancedDescription: enhancedDescription,
          aiSuggestedPrice: suggestedPrice,
        },
        errors: readyForMarketing
          ? []
          : [`Property not ready: ${analysis.suggestions.join(', ')}`],
      };
    } catch (error) {
      this.logError('Input validation failed', error);

      return {
        stage: 'input_validation',
        humanInterventionRequired: true,
        agentOutputs: {
          ...state.agentOutputs,
          input_manager: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: false,
            data: null,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        },
        errors: [...(state.errors || []), `Input Manager failed: ${error}`],
      };
    }
  }
}
