import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {askAI} from '@/ai/router';

type HistoryItem = { role: 'user' | 'assistant'; content: string; imageBase64?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      question: string;
      systemPrompt?: string;
      imageBase64?: string;
      pdfBase64?: string;
      history?: HistoryItem[];
    };

    // Debug logging
    console.log("API route called with:", {
      question: body.question,
      hasImage: !!body.imageBase64,
      historyLength: body.history?.length || 0,
      imageLength: body.imageBase64?.length || 0,
    });

    if (!body || typeof body.question !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const answer = await askAI({
      question: body.question,
      system: body.systemPrompt || "",
      history: body.history as any,
      imageBase64: body.imageBase64,
      pdfBase64: body.pdfBase64,
    });

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error('API /api/chat error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';