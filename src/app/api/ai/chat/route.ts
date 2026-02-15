import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssignmentContext {
  title: string;
  course: string;
  description?: string;
  dueDate?: string;
  pointsPossible?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, messages = [], assignment, mode = 'help' } = body as {
      message: string;
      messages?: ChatMessage[];
      assignment?: AssignmentContext;
      mode?: 'help' | 'study' | 'summary';
    };

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build system context based on mode and assignment
    let systemPrompt = '';

    if (mode === 'study' && assignment) {
      systemPrompt = `You are a helpful study assistant for a high school student. The student has an upcoming ${assignment.title ? 'test/quiz' : 'assignment'}:

Title: ${assignment.title || 'Unknown'}
Course: ${assignment.course || 'Unknown'}
Due: ${assignment.dueDate || 'Not specified'}
${assignment.description ? `Description: ${assignment.description}` : ''}

Help them prepare by providing study strategies, explaining concepts, and giving practice questions. Be encouraging and break down complex topics into manageable parts. Don't give direct answers to homework - guide them to understand.`;
    } else if (mode === 'summary' && assignment) {
      systemPrompt = `Summarize this assignment concisely:
Title: ${assignment.title}
Course: ${assignment.course}
Description: ${assignment.description || 'No description'}
Due: ${assignment.dueDate || 'Not specified'}

Provide a 2-3 sentence summary of what the student needs to do.`;
    } else if (assignment) {
      systemPrompt = `You are a helpful homework assistant for a high school student. They're working on:

Title: ${assignment.title || 'Unknown'}
Course: ${assignment.course || 'Unknown'}
${assignment.description ? `Description: ${assignment.description}` : ''}

Help them understand concepts and guide them toward solutions without giving direct answers. Encourage critical thinking and explain step-by-step when needed.`;
    } else {
      systemPrompt = `You are a friendly and helpful study assistant for a high school student. Help them with:
- Understanding concepts and assignments
- Study strategies and time management
- Homework guidance (explain, don't give answers)
- Test preparation tips
- Organization and prioritization

Be encouraging, clear, and break down complex topics. Keep responses concise but thorough.`;
    }

    // Check which AI provider is available and try them
    if (ANTHROPIC_API_KEY) {
      try {
        return await chatWithAnthropic(systemPrompt, messages, message);
      } catch (error) {
        console.error('Anthropic failed, trying OpenAI:', error);
        if (OPENAI_API_KEY) {
          return await chatWithOpenAI(systemPrompt, messages, message);
        }
        throw error;
      }
    } else if (OPENAI_API_KEY) {
      return await chatWithOpenAI(systemPrompt, messages, message);
    } else {
      return NextResponse.json(
        { error: 'No AI API key configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('AI chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
    // Check for billing/credit issues
    if (errorMessage.includes('credit balance') || errorMessage.includes('billing')) {
      return NextResponse.json(
        { error: 'AI service requires credits. Please check your API account billing settings.' },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to get AI response. Please try again later.' },
      { status: 500 }
    );
  }
}

async function chatWithOpenAI(systemPrompt: string, history: ChatMessage[], message: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI error:', errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const reply = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

  return NextResponse.json({ reply });
}

async function chatWithAnthropic(systemPrompt: string, history: ChatMessage[], message: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Anthropic error:', errorText);
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const reply = data.content[0]?.text || 'Sorry, I could not generate a response.';

  return NextResponse.json({ reply });
}
