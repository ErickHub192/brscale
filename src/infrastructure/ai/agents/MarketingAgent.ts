/**
 * Marketing Agent
 * Uses authentic content voices with LLM generation and A/B testing tracking
 */

import { BaseAgent, AgentConfig } from './BaseAgent';
import { PropertyWorkflowStateType, MarketingContent } from '../types/WorkflowState';
import { TOOL_CATEGORIES } from '../tools/allTools';
import { AI_CONFIG } from '@/infrastructure/config/env';
import {
  VoiceSelector,
  CONTENT_VOICES,
  PLATFORM_ADJUSTMENTS,
  ContentVoice,
} from './marketing/ContentVoices';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class MarketingAgent extends BaseAgent {
  private voiceSelector: VoiceSelector;

  constructor() {
    const config: AgentConfig = {
      name: 'Marketing Agent',
      description:
        'Creates authentic, non-spammy marketing content using multiple content voices with A/B testing',
      tools: TOOL_CATEGORIES.MARKETING,
      temperature: AI_CONFIG.temperature.creative, // 0.7 for creative content
      maxTokens: AI_CONFIG.maxTokens.long, // 4000 tokens
      systemPrompt: `You are an expert real estate marketing content creator.

Your goal is to create AUTHENTIC, ENGAGING content that DOES NOT look like spam.

Key principles:
1. Write like a human, not a bot
2. Tell stories, don't just list features
3. Use emojis sparingly and naturally
4. Keep hashtags minimal and relevant
5. Focus on lifestyle and community, not just specs
6. Be conversational and genuine
7. Avoid ALL CAPS and excessive punctuation
8. Create emotional connection

You will be given a specific "voice" to use for each post. Follow that voice's guidelines exactly.`,
    };

    super(config);
    this.voiceSelector = new VoiceSelector();
  }

  async execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType>> {
    this.log('Starting authentic marketing content generation');

    try {
      const { property, propertyId } = state;

      if (!property) {
        throw new Error('Property data not found in state');
      }

      const description = property.aiEnhancedDescription || property.description;

      // Determine property context for voice selection
      const propertyContext = {
        propertyId,
        propertyType: property.propertyType,
        price: property.price,
        hasHistory: false, // TODO: detect if property has interesting history
        neighborhoodKnown: true, // TODO: check if we have neighborhood data
      };

      // Select voice using contextual strategy (can be changed to 'sequential' or 'random')
      const selectedVoice = this.voiceSelector.selectVoice(propertyContext, 'contextual');
      const voiceTemplate = CONTENT_VOICES[selectedVoice];

      this.log('Voice selected for this property', {
        voice: selectedVoice,
        tone: voiceTemplate.tone,
      });

      // Generate content for each platform using the selected voice
      const socialPosts: MarketingContent['socialPosts'] = [];

      // Facebook Post (longer form, storytelling works well)
      this.log('Generating Facebook post with voice:', selectedVoice);
      const facebookVoice = this.getBestVoiceForPlatform(selectedVoice, 'facebook');
      const facebookPost = await this.generatePlatformPost({
        platform: 'facebook',
        voice: facebookVoice,
        property,
        description,
      });
      socialPosts.push(facebookPost);

      // Instagram Post (visual-first, casual works well)
      this.log('Generating Instagram post');
      const instagramVoice = this.getBestVoiceForPlatform(selectedVoice, 'instagram');
      const instagramPost = await this.generatePlatformPost({
        platform: 'instagram',
        voice: instagramVoice,
        property,
        description,
      });
      socialPosts.push(instagramPost);

      // LinkedIn Post (professional audience)
      this.log('Generating LinkedIn post');
      const linkedinPost = await this.generatePlatformPost({
        platform: 'linkedin',
        voice: 'professional', // Always professional for LinkedIn
        property,
        description,
      });
      socialPosts.push(linkedinPost);

      // Twitter Post (short, punchy)
      this.log('Generating Twitter post');
      const twitterPost = await this.generatePlatformPost({
        platform: 'twitter',
        voice: 'casual', // Always casual for Twitter
        property,
        description,
      });
      socialPosts.push(twitterPost);

      // Generate SEO-optimized listing description
      const listingDescription = this.generateListingDescription(property, description);

      // Generate email campaign
      const emailCampaign = await this.generateEmailCampaign(property, description, selectedVoice);

      // Generate SEO keywords
      const seoKeywords = this.generateSEOKeywords(property);

      // Create marketing content object
      const marketingContent: MarketingContent = {
        socialPosts,
        listingDescription,
        seoKeywords,
        emailCampaign,
      };

      // Get voice analytics for tracking
      const voiceAnalytics = this.voiceSelector.getAnalytics();

      this.log('Marketing content generation complete', {
        primaryVoice: selectedVoice,
        socialPosts: socialPosts.length,
        analytics: voiceAnalytics,
      });

      // Update state
      return {
        stage: 'lead_management',
        marketingContent,
        agentOutputs: {
          ...state.agentOutputs,
          marketing: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: true,
            data: {
              contentGenerated: true,
              primaryVoice: selectedVoice,
              platformsTargeted: socialPosts.map((p) => p.platform),
              socialPosts: socialPosts.map((p) => ({
                platform: p.platform,
                content: p.content,
                hashtags: p.hashtags,
              })),
              listingDescription,
              seoKeywords,
              emailCampaign: emailCampaign ? {
                subject: emailCampaign.subject,
                preview: emailCampaign.body.substring(0, 200) + '...',
              } : undefined,
              voiceAnalytics,
            },
            nextAction: 'Content ready for distribution. Proceed to Lead Management.',
          },
        },
      };
    } catch (error) {
      this.logError('Marketing content generation failed', error);

      return {
        stage: 'marketing',
        humanInterventionRequired: true,
        agentOutputs: {
          ...state.agentOutputs,
          marketing: {
            agentName: this.config.name,
            timestamp: new Date(),
            success: false,
            data: null,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        },
        errors: [...(state.errors || []), `Marketing Agent failed: ${error}`],
      };
    }
  }

  /**
   * Generate platform-specific post using LLM
   */
  private async generatePlatformPost(params: {
    platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter';
    voice: ContentVoice;
    property: any;
    description: string | null;
  }): Promise<MarketingContent['socialPosts'][0]> {
    const { platform, voice, property, description } = params;

    const voiceTemplate = CONTENT_VOICES[voice];
    const platformConfig = PLATFORM_ADJUSTMENTS[platform];

    // Create prompt for LLM
    const prompt = `${voiceTemplate.examplePrompt}

Now write a ${platform} post for this property using the ${voice} voice:

Property Details:
- Title: ${property.title}
- Location: ${property.address.city}, ${property.address.state}
- Type: ${property.propertyType}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms || 'N/A'}
- Square Feet: ${property.squareFeet || 'N/A'}
- Price: $${property.price.toLocaleString()}
- Description: ${description || 'Beautiful property available for viewing'}

Platform: ${platform}
Max length: ${platformConfig.maxLength} characters
Emoji usage: ${voiceTemplate.emojiUsage}
Max hashtags: ${voiceTemplate.hashtagCount}

Write ONLY the post content. Make it authentic and engaging, not spammy.`;

    // Call LLM to generate content
    const messages = [new SystemMessage(this.config.systemPrompt), new HumanMessage(prompt)];

    // Bind tools to model (required to avoid parallel_tool_calls error)
    const validTools = this.config.tools.filter(tool => tool != null);
    const modelWithTools = this.model.bindTools(validTools);

    const response = await modelWithTools.invoke(messages);
    const content = response.content.toString().trim();

    // Extract hashtags from content
    const hashtagRegex = /#\w+/g;
    const hashtags = content.match(hashtagRegex) || [];

    return {
      platform,
      content,
      hashtags,
      imageUrl: property.images[0] || undefined,
    };
  }

  /**
   * Select best voice for platform if different from primary voice
   */
  private getBestVoiceForPlatform(primaryVoice: ContentVoice, platform: string): ContentVoice {
    const platformConfig = PLATFORM_ADJUSTMENTS[platform as keyof typeof PLATFORM_ADJUSTMENTS];

    // If primary voice is preferred for this platform, use it
    if (platformConfig.preferredVoices.includes(primaryVoice)) {
      return primaryVoice;
    }

    // Otherwise, use the first preferred voice for this platform
    return platformConfig.preferredVoices[0] as ContentVoice;
  }

  /**
   * Generate SEO-optimized listing description
   */
  private generateListingDescription(property: any, description: string | null): string {
    return `${property.title} - ${property.address.city}, ${property.address.state}

Premium ${property.propertyType} featuring ${property.bedrooms} bedrooms and ${property.bathrooms || 'N/A'} bathrooms across ${property.squareFeet || 'N/A'} square feet.

${description || 'Beautiful property available for viewing.'}

Property Details:
- Type: ${property.propertyType}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms || 'N/A'}
- Square Footage: ${property.squareFeet ? property.squareFeet + ' sq ft' : 'N/A'}
- Price: $${property.price.toLocaleString()}
- Location: ${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zipCode}

Schedule a showing today.`;
  }

  /**
   * Generate email campaign
   */
  private async generateEmailCampaign(
    property: any,
    description: string | null,
    voice: ContentVoice
  ): Promise<MarketingContent['emailCampaign']> {
    // Use storytelling or professional voice for email
    const emailVoice = voice === 'behind_scenes' ? 'storytelling' : voice;

    return {
      subject: `${property.address.city} Property: ${property.bedrooms} bed, ${property.bathrooms || 'N/A'} bath ${property.propertyType}`,
      body: `
${description || 'Beautiful property available for viewing.'}

This ${property.propertyType} is located in ${property.address.city}, ${property.address.state} and offers ${property.bedrooms} bedrooms, ${property.bathrooms || 'N/A'} bathrooms, and ${property.squareFeet || 'N/A'} square feet of living space.

Priced at $${property.price.toLocaleString()}.

I'd love to show you this property. Reply to this email or call me to schedule a private tour.
      `,
      targetAudience: `Buyers interested in ${property.propertyType} in ${property.address.city}, budget $${Math.round(property.price * 0.9).toLocaleString()} - $${Math.round(property.price * 1.1).toLocaleString()}`,
    };
  }

  /**
   * Generate SEO keywords (non-spammy, natural)
   */
  private generateSEOKeywords(property: any): string[] {
    return [
      `${property.propertyType} ${property.address.city}`,
      `${property.bedrooms} bedroom home ${property.address.state}`,
      `${property.address.city} real estate`,
      `homes for sale ${property.address.zipCode}`,
      `${property.address.city} ${property.propertyType}`,
    ];
  }
}
