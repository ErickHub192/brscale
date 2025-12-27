/**
 * Marketing Content Voices & Styles
 * Different authentic voices for social media posts with A/B testing tracking
 */

export type ContentVoice = 'storytelling' | 'casual' | 'professional' | 'community' | 'behind_scenes';

export interface VoiceTemplate {
  voice: ContentVoice;
  description: string;
  tone: string;
  emojiUsage: 'none' | 'minimal' | 'moderate';
  hashtagCount: number;
  examplePrompt: string;
}

/**
 * Content Voice Templates
 * Each voice has specific characteristics for authentic, non-spammy posts
 */
export const CONTENT_VOICES: Record<ContentVoice, VoiceTemplate> = {
  storytelling: {
    voice: 'storytelling',
    description: 'Narrative-driven, emotional connection, property history',
    tone: 'Warm, personal, evocative',
    emojiUsage: 'minimal',
    hashtagCount: 3,
    examplePrompt: `Write a compelling story about this property. Focus on:
- The property's unique history or character
- Paint a picture of life in this home
- What makes this place special beyond specs
- Use natural, conversational language
- NO all-caps, NO excessive emojis
- Include 1-2 subtle emojis max
- End with a simple call-to-action

Example style:
"Built in 1928, this craftsman home has sheltered three generations of families. The towering oak in the front yard was planted by the original owners. Walk through the door, and you can almost hear the echoes of Sunday dinners and children's laughter. The kitchen was lovingly modernized while keeping its vintage soul intact.

Today, it's ready for its next chapter. Could that be yours?"`,
  },

  casual: {
    voice: 'casual',
    description: 'Friendly, conversational, like talking to a friend',
    tone: 'Relaxed, approachable, genuine',
    emojiUsage: 'moderate',
    hashtagCount: 4,
    examplePrompt: `Write a casual, friendly post about this property. Think of texting a friend:
- Use conversational language ("this place is...", "you'll love...")
- Share what genuinely excites you about it
- Be real, not salesy
- Use 2-3 well-placed emojis (not spam)
- Natural enthusiasm, not forced hype
- Personal touch

Example style:
"Okay, I have to show you this place. Just walked through it and I'm still thinking about that kitchen 😍

The natural light? Incredible. And whoever designed this layout really understood how people actually live. The primary bedroom has this reading nook by the window that I immediately imagined spending my Sunday mornings in.

It's in [neighborhood], walkable to that coffee shop everyone loves. DM me if you want the full tour."`,
  },

  professional: {
    voice: 'professional',
    description: 'Polished, informative, expertise-focused',
    tone: 'Authoritative, trustworthy, sophisticated',
    emojiUsage: 'minimal',
    hashtagCount: 5,
    examplePrompt: `Write a professional, expertise-focused post:
- Lead with market insight or investment angle
- Use specific data points when relevant
- Demonstrate local knowledge
- Sophisticated but accessible language
- Minimal emojis (1 max)
- Focus on value proposition
- Professional call-to-action

Example style:
"New to market in [neighborhood]: a rare find in one of the city's most desirable pockets.

This area has seen consistent appreciation over the past 5 years, with inventory remaining tight. Properties in this zip code typically receive multiple offers within the first week.

What sets this one apart: recent high-end renovation, prime location within the school district, and a layout that maximizes the square footage.

For serious buyers looking in [neighborhood], this warrants a closer look. Schedule a private showing this week."`,
  },

  community: {
    voice: 'community',
    description: 'Neighborhood-focused, local guide, lifestyle content',
    tone: 'Knowledgeable, helpful, community-connected',
    emojiUsage: 'minimal',
    hashtagCount: 4,
    examplePrompt: `Write a community-focused post highlighting the neighborhood:
- Share local spots and hidden gems
- Focus on lifestyle, not just the house
- Show you know the area intimately
- Help buyers envision their life there
- 1-2 subtle emojis
- Be a local guide, not a salesperson

Example style:
"What I love about [neighborhood]:

Saturday mornings at [local coffee shop], where the barista knows your order by week two. The farmer's market on Sundays with the best sourdough you'll find. That little park on [street] where neighbors actually know each other's names.

This property puts you right in the heart of it all. Three blocks from the best taco spot in the city (locals know), walking distance to the trail system, and the kind of quiet streets where people still sit on their porches in the evening.

If you've been looking for a real neighborhood feel, let's talk."`,
  },

  behind_scenes: {
    voice: 'behind_scenes',
    description: 'Authentic agent life, day-in-the-life, relatable',
    tone: 'Real, unfiltered, human',
    emojiUsage: 'moderate',
    hashtagCount: 3,
    examplePrompt: `Write a behind-the-scenes, authentic agent post:
- Show the real work, not just glamour
- Be vulnerable or funny
- Share insights from your experience
- Connect property to your journey
- 2-3 authentic emojis
- Make it relatable and human

Example style:
"Real talk: I've shown 47 properties in the last two weeks. My feet hurt, I've developed a coffee addiction, and I can spot bad staging from a mile away 😅

But then I walk into a place like this one, and it reminds me why I do this.

Sometimes a property just hits different. The flow makes sense. The light is right. You can actually picture your life unfolding there. That's what happened today.

Not every listing needs to be 'perfect' on paper. Sometimes it just needs to be right for you. That's what I'm here to help you find."`,
  },
};

/**
 * Voice Selection Strategy
 */
export type VoiceSelectionStrategy = 'sequential' | 'contextual' | 'random';

/**
 * Voice Selector
 * Intelligently selects which voice to use based on strategy
 */
export class VoiceSelector {
  private lastVoiceUsed: ContentVoice | null = null;
  private voiceHistory: { voice: ContentVoice; timestamp: Date; propertyId: string }[] = [];

  /**
   * Select next voice based on strategy
   */
  selectVoice(
    propertyContext: {
      propertyId: string;
      propertyType: string;
      price: number;
      hasHistory?: boolean;
      neighborhoodKnown?: boolean;
    },
    strategy: VoiceSelectionStrategy = 'contextual'
  ): ContentVoice {
    let selectedVoice: ContentVoice;

    switch (strategy) {
      case 'sequential':
        selectedVoice = this.selectSequential();
        break;

      case 'contextual':
        selectedVoice = this.selectContextual(propertyContext);
        break;

      case 'random':
        selectedVoice = this.selectRandom();
        break;

      default:
        selectedVoice = 'casual';
    }

    // Track selection
    this.voiceHistory.push({
      voice: selectedVoice,
      timestamp: new Date(),
      propertyId: propertyContext.propertyId,
    });

    this.lastVoiceUsed = selectedVoice;

    return selectedVoice;
  }

  /**
   * Sequential rotation (round-robin)
   */
  private selectSequential(): ContentVoice {
    const voices: ContentVoice[] = [
      'storytelling',
      'casual',
      'professional',
      'community',
      'behind_scenes',
    ];

    if (!this.lastVoiceUsed) {
      return voices[0];
    }

    const currentIndex = voices.indexOf(this.lastVoiceUsed);
    const nextIndex = (currentIndex + 1) % voices.length;
    return voices[nextIndex];
  }

  /**
   * Contextual selection based on property characteristics
   */
  private selectContextual(propertyContext: {
    propertyType: string;
    price: number;
    hasHistory?: boolean;
    neighborhoodKnown?: boolean;
  }): ContentVoice {
    // High-end luxury → professional
    if (propertyContext.price > 1000000) {
      return Math.random() > 0.5 ? 'professional' : 'storytelling';
    }

    // Property has interesting history → storytelling
    if (propertyContext.hasHistory) {
      return 'storytelling';
    }

    // Known vibrant neighborhood → community
    if (propertyContext.neighborhoodKnown) {
      return 'community';
    }

    // First-time buyer range → casual
    if (propertyContext.price < 400000) {
      return Math.random() > 0.5 ? 'casual' : 'community';
    }

    // Default: rotate between casual, community, behind_scenes
    const casual_voices: ContentVoice[] = ['casual', 'community', 'behind_scenes'];
    return casual_voices[Math.floor(Math.random() * casual_voices.length)];
  }

  /**
   * Random selection (true A/B testing)
   */
  private selectRandom(): ContentVoice {
    const voices: ContentVoice[] = [
      'storytelling',
      'casual',
      'professional',
      'community',
      'behind_scenes',
    ];
    return voices[Math.floor(Math.random() * voices.length)];
  }

  /**
   * Get voice usage analytics
   */
  getAnalytics(): {
    totalPosts: number;
    voiceDistribution: Record<ContentVoice, number>;
    lastUsed: ContentVoice | null;
  } {
    const distribution: Record<ContentVoice, number> = {
      storytelling: 0,
      casual: 0,
      professional: 0,
      community: 0,
      behind_scenes: 0,
    };

    this.voiceHistory.forEach((entry) => {
      distribution[entry.voice]++;
    });

    return {
      totalPosts: this.voiceHistory.length,
      voiceDistribution: distribution,
      lastUsed: this.lastVoiceUsed,
    };
  }

  /**
   * Get template for selected voice
   */
  getTemplate(voice: ContentVoice): VoiceTemplate {
    return CONTENT_VOICES[voice];
  }
}

/**
 * Platform-specific adjustments
 */
export const PLATFORM_ADJUSTMENTS = {
  facebook: {
    maxLength: 500,
    allowLongerForm: true,
    preferredVoices: ['storytelling', 'community', 'casual'],
  },
  instagram: {
    maxLength: 300,
    allowLongerForm: false,
    preferredVoices: ['casual', 'behind_scenes', 'storytelling'],
    captionFirst: true, // First 125 chars are critical
  },
  linkedin: {
    maxLength: 600,
    allowLongerForm: true,
    preferredVoices: ['professional', 'storytelling'],
  },
  twitter: {
    maxLength: 280,
    allowLongerForm: false,
    preferredVoices: ['casual', 'community'],
  },
};
