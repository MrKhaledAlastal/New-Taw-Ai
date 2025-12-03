import { NextResponse } from 'next/server';
import { askAI } from '@/ai/router';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, question } = body;

    console.log("Test route called with:", {
      hasImage: !!imageBase64,
      question,
      imageLength: imageBase64?.length || 0,
    });

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const answer = await askAI({
      question: question || "What is in this image?",
      system: "You are a helpful AI assistant that can analyze images.",
      history: [],
      imageBase64: imageBase64,
      pdfBase64: undefined,
    });

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error('Test route error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';