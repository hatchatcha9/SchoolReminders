import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface AssignmentInfo {
  title: string;
  course: string;
  type: string;
  dueDate?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignment } = body as { assignment: AssignmentInfo };

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment info is required' },
        { status: 400 }
      );
    }

    const prompt = `A high school student has an upcoming ${assignment.type || 'test'}:

Title: ${assignment.title}
Course: ${assignment.course}
Due: ${assignment.dueDate || 'Not specified'}
${assignment.description ? `Description: ${assignment.description}` : ''}

Provide study tips in JSON format with these fields:
{
  "summary": "Brief 1-2 sentence summary of what to prepare for",
  "strategies": ["Array of 3-4 specific study strategies"],
  "timeEstimate": "Estimated study time recommendation",
  "focusAreas": ["Key topics/areas to focus on"],
  "tips": ["2-3 helpful tips for test day"]
}

Keep strategies specific and actionable. Be encouraging.`;

    let result;

    if (ANTHROPIC_API_KEY) {
      result = await generateWithAnthropic(prompt);
    } else if (OPENAI_API_KEY) {
      result = await generateWithOpenAI(prompt);
    } else {
      // Return fallback
      result = JSON.stringify(generateFallbackTips(assignment));
    }

    // Try to parse JSON from response
    try {
      const parsed = JSON.parse(result);
      return NextResponse.json(parsed);
    } catch {
      // If not valid JSON, return structured fallback with AI text
      return NextResponse.json({
        summary: result.slice(0, 200),
        strategies: ['Review class notes', 'Practice problems', 'Study with flashcards'],
        timeEstimate: '2-3 hours',
        focusAreas: ['Key concepts from the unit'],
        tips: ['Get good sleep the night before', 'Eat a healthy breakfast'],
      });
    }
  } catch (error) {
    console.error('Study tips generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate study tips' },
      { status: 500 }
    );
  }
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful study coach. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '{}';
}

async function generateWithAnthropic(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: 'You are a helpful study coach. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Anthropic study tips error:', errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '{}';
}

function generateFallbackTips(assignment: AssignmentInfo) {
  const isTest = assignment.type === 'test' || assignment.type === 'quiz' ||
    assignment.title.toLowerCase().includes('test') ||
    assignment.title.toLowerCase().includes('quiz');

  return {
    summary: `Prepare for your ${assignment.title} in ${assignment.course}. Review all relevant materials and practice key concepts.`,
    strategies: isTest ? [
      'Review your class notes and highlight key concepts',
      'Create flashcards for important terms and definitions',
      'Practice with sample problems or past quizzes',
      'Teach the material to someone else to reinforce understanding',
    ] : [
      'Break the assignment into smaller tasks',
      'Start with the parts you understand best',
      'Use your textbook and class notes as references',
      'Ask for help if you get stuck on any section',
    ],
    timeEstimate: isTest ? '2-4 hours over 2-3 days' : '1-2 hours',
    focusAreas: [
      'Main concepts from recent lessons',
      'Any topics your teacher emphasized',
      'Areas you found challenging',
    ],
    tips: [
      'Get a good night\'s sleep before the test',
      'Eat a healthy breakfast',
      'Arrive early and stay calm',
    ],
  };
}
