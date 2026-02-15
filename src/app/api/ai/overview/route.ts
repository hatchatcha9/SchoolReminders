import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface AssignmentSummary {
  title: string;
  course: string;
  dueDate: string;
  type: string;
  priority: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignments } = body as { assignments: AssignmentSummary[] };

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Assignments array is required' },
        { status: 400 }
      );
    }

    // Check cache first (cached for the current day)
    const cacheKey = `daily-overview-${new Date().toDateString()}`;
    const assignmentHash = JSON.stringify(assignments.map(a => a.title).sort()).slice(0, 100);

    // Build assignment list for prompt
    const assignmentList = assignments
      .slice(0, 10) // Limit to first 10 for brevity
      .map(a => `- ${a.title} (${a.course}) - Due: ${a.dueDate} [${a.priority} priority]`)
      .join('\n');

    const urgentCount = assignments.filter(a => a.priority === 'high').length;
    const testCount = assignments.filter(a =>
      a.type === 'test' || a.type === 'quiz' ||
      a.title.toLowerCase().includes('test') ||
      a.title.toLowerCase().includes('quiz')
    ).length;

    const prompt = `Create a brief, encouraging daily overview for a high school student. Here's what they have coming up:

Total assignments: ${assignments.length}
Urgent items (due soon): ${urgentCount}
Tests/Quizzes: ${testCount}

Upcoming assignments:
${assignmentList || 'No upcoming assignments!'}

Write 2-3 sentences that:
1. Acknowledge their workload in a supportive way
2. Highlight any urgent items or tests they should focus on
3. End with a motivating message

Keep it friendly and concise. Don't use bullet points.`;

    let overview: string;

    // Check which AI provider is available
    try {
      if (ANTHROPIC_API_KEY) {
        overview = await generateWithAnthropic(prompt);
      } else if (OPENAI_API_KEY) {
        overview = await generateWithOpenAI(prompt);
      } else {
        // Fallback without AI
        overview = generateFallbackOverview(assignments.length, urgentCount, testCount);
      }
    } catch (aiError) {
      console.error('AI generation failed, using fallback:', aiError);
      // Use fallback overview when AI fails
      overview = generateFallbackOverview(assignments.length, urgentCount, testCount);
    }

    return NextResponse.json({
      overview,
      cacheKey,
      assignmentHash,
    });
  } catch (error) {
    console.error('Overview generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate overview' },
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
          content: 'You are a friendly and encouraging study assistant for high school students. Keep responses brief and motivating.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || generateFallbackOverview(0, 0, 0);
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
      max_tokens: 200,
      system: 'You are a friendly and encouraging study assistant for high school students. Keep responses brief and motivating.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Anthropic API error body:', errorBody);
    throw new Error(`Anthropic API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.content[0]?.text || generateFallbackOverview(0, 0, 0);
}

function generateFallbackOverview(total: number, urgent: number, tests: number): string {
  if (total === 0) {
    return "You're all caught up! No upcoming assignments right now. Great time to review past material or get ahead on future topics.";
  }

  let message = '';

  if (urgent > 0) {
    message = `You have ${urgent} urgent item${urgent > 1 ? 's' : ''} to focus on today. `;
  } else {
    message = `You have ${total} assignment${total > 1 ? 's' : ''} coming up. `;
  }

  if (tests > 0) {
    message += `Don't forget to study for your ${tests} upcoming test${tests > 1 ? 's' : ''}! `;
  }

  message += "You've got this - tackle one thing at a time!";

  return message;
}
