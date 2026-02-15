import { UnifiedAssignment, StudyStrategy } from '@/types';

/**
 * AI Client for generating summaries, study strategies, and homework help
 *
 * Supports both OpenAI and Anthropic APIs
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type AIProvider = 'openai' | 'anthropic';

class AIClient {
  private provider: AIProvider;
  private apiKey: string;

  constructor() {
    if (ANTHROPIC_API_KEY) {
      this.provider = 'anthropic';
      this.apiKey = ANTHROPIC_API_KEY;
    } else if (OPENAI_API_KEY) {
      this.provider = 'openai';
      this.apiKey = OPENAI_API_KEY;
    } else {
      throw new Error('No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
  }

  /**
   * Generate a summary of an assignment
   */
  async summarizeAssignment(assignment: UnifiedAssignment): Promise<string> {
    const prompt = `Summarize this school assignment in 2-3 sentences for a student:

Title: ${assignment.title}
Course: ${assignment.course}
Due: ${assignment.dueDate?.toLocaleDateString() || 'No due date'}
Description: ${assignment.description || 'No description provided'}

Keep it concise and highlight the key requirements.`;

    return this.chat(prompt);
  }

  /**
   * Generate study strategies for a test
   */
  async generateStudyStrategies(assignment: UnifiedAssignment): Promise<StudyStrategy> {
    const prompt = `A student has an upcoming test/quiz. Generate helpful study strategies.

Test: ${assignment.title}
Course: ${assignment.course}
Date: ${assignment.dueDate?.toLocaleDateString() || 'Unknown'}
Description: ${assignment.description || 'No description provided'}

Provide:
1. 3-5 specific study strategies
2. Estimated study time recommendation
3. 2-3 helpful resources or study methods

Format as JSON with keys: strategies (array), estimatedStudyTime (string), resources (array)`;

    const response = await this.chat(prompt);

    try {
      const parsed = JSON.parse(response);
      return {
        assignmentId: assignment.id,
        strategies: parsed.strategies || [],
        estimatedStudyTime: parsed.estimatedStudyTime || 'Unknown',
        resources: parsed.resources || [],
      };
    } catch {
      return {
        assignmentId: assignment.id,
        strategies: [response],
        estimatedStudyTime: 'Unknown',
        resources: [],
      };
    }
  }

  /**
   * Get homework help for a specific question
   */
  async getHomeworkHelp(
    assignment: UnifiedAssignment,
    question: string
  ): Promise<string> {
    const prompt = `A student needs help with their homework.

Assignment: ${assignment.title}
Course: ${assignment.course}
Description: ${assignment.description || 'No description'}

Student's question: ${question}

Provide a helpful explanation that guides the student toward understanding, without just giving the answer. Use clear examples if helpful.`;

    return this.chat(prompt);
  }

  /**
   * Generate a daily overview summary
   */
  async generateDailyOverview(assignments: UnifiedAssignment[]): Promise<string> {
    const assignmentList = assignments
      .map(a => `- ${a.title} (${a.course}) - Due: ${a.dueDate?.toLocaleDateString() || 'No date'}`)
      .join('\n');

    const prompt = `Create a brief, encouraging daily overview for a student with these upcoming assignments:

${assignmentList}

Keep it to 2-3 sentences. Mention any urgent items and give a motivating tip.`;

    return this.chat(prompt);
  }

  /**
   * Core chat function - sends request to configured AI provider
   */
  private async chat(prompt: string): Promise<string> {
    if (this.provider === 'anthropic') {
      return this.chatAnthropic(prompt);
    } else {
      return this.chatOpenAI(prompt);
    }
  }

  private async chatOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }
}

// Lazy initialization to avoid errors when API keys aren't set during build
let aiClientInstance: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient();
  }
  return aiClientInstance;
}

export { AIClient };
