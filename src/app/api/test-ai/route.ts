import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'OPENAI_API_KEY not configured'
    }, { status: 500 });
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant testing API connectivity.'
        },
        {
          role: 'user',
          content: 'Respond with a single sentence confirming the API is working.'
        }
      ],
      max_tokens: 50,
    });

    const response = completion.choices[0].message.content;

    return NextResponse.json({
      success: true,
      message: 'OpenAI API is working!',
      response: response,
      model: completion.model,
      usage: completion.usage
    });
  } catch (error) {
    console.error('OpenAI test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

