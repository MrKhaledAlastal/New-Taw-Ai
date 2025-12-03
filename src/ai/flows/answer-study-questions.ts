'use server';

import { ai } from '@/ai/genkit';
import { askAI } from '@/ai/router';
import { z } from 'zod';

/* ======================= Schemas ======================= */

const HistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  imageBase64: z.string().optional(), // ✔ تم توحيد الاسم
});

const AnswerStudyQuestionInputSchema = z.object({
  question: z.string(),
  textbookContent: z.string(),
  availableBooks: z
    .array(
      z.object({
        id: z.string(),
        fileName: z.string(),
      })
    )
    .optional(),
  expandSearchOnline: z.boolean(),
  language: z.enum(['en', 'ar']).optional(),
  imageBase64: z.string().optional(), // ✔ الصورة من الرسالة الحالية (Data URI)
  history: z.array(HistoryMessageSchema).optional(),
});

export type AnswerStudyQuestionInput = z.infer<
  typeof AnswerStudyQuestionInputSchema
>;

const AnswerStudyQuestionOutputSchema = z.object({
  answer: z.string(),
  source: z.string(),
  sourceBookName: z.string().optional(),
  lang: z.enum(['en', 'ar']),
});

export type AnswerStudyQuestionOutput = z.infer<
  typeof AnswerStudyQuestionOutputSchema
>;

/* ======================= Main Function ======================= */

export async function answerStudyQuestion(input: AnswerStudyQuestionInput) {
  // Debug logging
  console.log("answerStudyQuestion called with:", {
    question: input.question,
    hasImage: !!input.imageBase64,
    historyLength: input.history?.length || 0,
    imageLength: input.imageBase64?.length || 0,
  });

  return answerStudyQuestionFlow(input);
}

/* ======================= Flow ======================= */

const answerStudyQuestionFlow = ai.defineFlow(
  {
    name: 'answerStudyQuestionFlow',
    inputSchema: AnswerStudyQuestionInputSchema,
    outputSchema: AnswerStudyQuestionOutputSchema,
  },

  async (input) => {
    console.log("🟧 FLOW RECEIVED imageBase64:", input.imageBase64?.substring(0, 40));

    /* ---------- Detect Language ---------- */
    const detectLang = (txt: string): 'ar' | 'en' =>
      /[\u0600-\u06FF]/.test(txt) ? 'ar' : 'en';

    const lang = input.language || detectLang(input.question);

    /* ---------- Build System Prompt ---------- */
    const bookListTxt = input.availableBooks?.length
      ? `Available books: ${input.availableBooks
        .map((b) => b.fileName)
        .join(', ')}`
      : 'No textbooks uploaded.';

    const systemPrompt =
      lang === 'ar'
        ? `
أنت "Tawjihi AI" من منصة Vextronic، مساعد ذكي متخصص في شرح مواد التوجيهي.
شرح الفكرة ببساطة وسهولة، واذكر اسم الكتاب عند استخدام أي معلومة منه.
${bookListTxt}
${input.textbookContent || ''}
`
        : `
You are "Tawjihi AI" by Vextronic, a smart assistant for high-school students.
Explain simply and mention the book if you use its content.
${bookListTxt}
${input.textbookContent || ''}
`;

    /* ---------- Prepare History: Just extract role and content ---------- */
    const rawHistory = (input.history ?? [])
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        // Preserve imageBase64 in history if present
        ...(m.imageBase64 ? { imageBase64: m.imageBase64 } : {}),
      }));

    /* ---------- Ask Model ---------- */
    let finalText: string;

    // Debug logging
    console.log("About to call askAI with:", {
      question: input.question,
      hasImage: !!input.imageBase64,
      historyLength: rawHistory?.length || 0,
      imageLength: input.imageBase64?.length || 0,
    });

    try {
      finalText = await askAI({
        question: input.question,
        system: systemPrompt,
        history: rawHistory,
        imageBase64: input.imageBase64 || undefined,
        pdfBase64: undefined,
      });
    } catch (err: any) {
      console.error('Router/AI Error:', err);
      throw new Error('AI_ERROR: ' + (err?.message || String(err)));
    }

    /* ---------- Book Detection ---------- */
    let detectedBook: string | undefined;

    if (input.availableBooks?.length) {
      const lower = finalText.toLowerCase();
      for (const book of input.availableBooks) {
        const clean = book.fileName.replace('.pdf', '').toLowerCase();
        if (lower.includes(clean)) {
          detectedBook = book.fileName;
          break;
        }
      }
    }

    /* ---------- Return ---------- */
    return {
      answer: finalText,
      source: detectedBook
        ? 'textbook'
        : input.expandSearchOnline
          ? 'web'
          : 'textbook',
      sourceBookName: detectedBook,
      lang,
    };
  }
);