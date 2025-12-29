/**
 * Base Agent Configuration
 * Shared configuration and utilities for all AI agents
 */

import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { env, AI_CONFIG } from '@/infrastructure/config/env';
import { PropertyWorkflowStateType } from '../types/WorkflowState';

/**
 * Agent Configuration
 */
export interface AgentConfig {
  name: string;
  description: string;
  tools: DynamicStructuredTool[];
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

/**
 * Create OpenAI Chat Model for an agent
 */
export function createAgentModel(config: {
  temperature: number;
  maxTokens: number;
}): ChatOpenAI {
  return new ChatOpenAI({
    model: AI_CONFIG.models.primary,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    openAIApiKey: env.OPENAI_API_KEY,
  });
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  agentName: string;
  success: boolean;
  output: any;
  errors?: string[];
  toolCalls?: {
    tool: string;
    input: any;
    output: any;
  }[];
  nextStage?: string;
  humanInterventionRequired?: boolean;
}

/**
 * Base Agent class
 * Provides common functionality for all agents
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected model: ChatOpenAI;

  constructor(config: AgentConfig) {
    this.config = config;
    this.model = createAgentModel({
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Validate tools (only log errors)
    const invalidTools = config.tools.filter(tool => tool == null);
    if (invalidTools.length > 0) {
      console.error(`[${config.name}] ERROR: ${invalidTools.length} undefined/null tools detected!`);
      console.error(`[${config.name}] Undefined tool indices: ${config.tools.map((t, i) => t == null ? i : null).filter(i => i !== null).join(', ')}`);
    }
  }

  /**
   * Execute the agent
   * Must be implemented by each agent
   * Can return either a state update or a Command for routing
   */
  abstract execute(state: PropertyWorkflowStateType): Promise<Partial<PropertyWorkflowStateType> | any>;

  /**
   * Get agent name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * Get agent tools
   */
  getTools(): DynamicStructuredTool[] {
    return this.config.tools;
  }

  /**
   * Create execution result
   */
  protected createResult(
    success: boolean,
    output: any,
    errors?: string[],
    nextStage?: string,
    humanInterventionRequired?: boolean
  ): AgentExecutionResult {
    return {
      agentName: this.config.name,
      success,
      output,
      errors,
      nextStage,
      humanInterventionRequired,
    };
  }

  /**
   * Log agent activity
   */
  protected log(message: string, data?: any): void {
    console.log(`[${this.config.name}] ${message}`, data || '');
  }

  /**
   * Log agent error
   */
  protected logError(message: string, error?: any): void {
    console.error(`[${this.config.name}] ERROR: ${message}`, error || '');
  }

  /**
   * Interpret human response using LLM
   * @param humanResponse - The human's response text
   * @param context - Context about what we're asking (e.g., "approve offer", "fix validation issues")
   * @param options - Array of valid options (e.g., ["APPROVE", "REJECT", "COUNTER"])
   * @returns The LLM's interpretation as one of the options
   */
  protected async interpretHumanResponse(
    humanResponse: string,
    context: string,
    options: string[]
  ): Promise<string> {
    this.log('Interpreting human response with LLM', { humanResponse, context, options });

    const interpretPrompt = `You are interpreting a human's response in a workflow.

Context: ${context}

Human response: "${humanResponse}"

Valid options:
${options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}

Based on the human's response, which option best matches their intent?

Respond with ONLY the exact option text (e.g., "${options[0]}") and nothing else.`;

    // Bind tools to the model (LLM can use tools if needed during interpretation)
    const validTools = this.config.tools.filter(tool => tool != null);
    const modelWithTools = validTools.length > 0
      ? this.model.bindTools(validTools)
      : this.model;

    const llmResponse = await modelWithTools.invoke([
      { role: 'system', content: this.config.systemPrompt },
      { role: 'user', content: interpretPrompt },
    ]);

    const decision = llmResponse.content.toString().trim().toUpperCase();

    // Find matching option
    const matchedOption = options.find((opt) => decision.includes(opt.toUpperCase()));

    if (matchedOption) {
      this.log('LLM interpreted human response', { decision: matchedOption });
      return matchedOption;
    }

    // Default to first option if no match
    this.log('LLM interpretation unclear, defaulting to first option', { decision });
    return options[0];
  }

  /**
   * Extract modification instructions from human response using LLM
   * @param humanResponse - The human's response with modification requests
   * @param currentOutput - The current agent output to be modified
   * @returns Structured modification instructions
   */
  protected async extractModificationInstructions(
    humanResponse: string,
    currentOutput: any
  ): Promise<{
    modifications: string;
    specificChanges: string[];
  }> {
    this.log('Extracting modification instructions from human feedback', { humanResponse });

    const extractPrompt = `You are analyzing human feedback on an agent's output to extract specific modification instructions.

Current agent output:
${JSON.stringify(currentOutput, null, 2)}

Human feedback: "${humanResponse}"

Extract and list the specific changes the human wants:
1. What should be modified?
2. How should it be modified?
3. Are there specific fields/values to change?

Respond with a JSON object:
{
  "modifications": "summary of what to change",
  "specificChanges": ["change 1", "change 2", "..."]
}`;

    // Bind tools to the model (LLM can use tools if needed during extraction)
    // Filter out any undefined/null tools to avoid errors
    const validTools = this.config.tools.filter(tool => tool != null);

    const modelWithTools = validTools.length > 0
      ? this.model.bindTools(validTools)
      : this.model;

    const llmResponse = await modelWithTools.invoke([
      { role: 'system', content: 'You are a precise instruction extractor. Always respond with valid JSON.' },
      { role: 'user', content: extractPrompt },
    ]);

    const responseText = llmResponse.content.toString().trim();

    // Extract JSON from response (in case LLM adds markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      this.log('Modification instructions extracted', extracted);
      return extracted;
    }

    // Fallback
    return {
      modifications: humanResponse,
      specificChanges: [humanResponse],
    };
  }
}
