'use server';

import { answerStudyQuestion, AnswerStudyQuestionInput } from '@/ai/flows/answer-study-questions';
import { Message } from '@/components/chat/chat-interface';

// 🆕 توحيد اسم الحقل هنا ليعكس ما يرسله chat-interface.tsx
type HistoryItem = {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string | null; // ✔ توحيد الاسم لـ imageBase64
};

// ==================================================================
//                     الدالة الرئيسية askQuestionAction
// ==================================================================
export async function askQuestionAction(args: {
  question: string;
  expandSearchOnline: boolean;
  language: 'en' | 'ar';
  userId?: string;
  imageBase64?: string | null; // ✔ توحيد الاسم للصورة الحالية
  history: HistoryItem[]; // ✔ يستقبل التاريخ بالصيغة الجديدة
  chatId?: string | null;
  availableBooks?: { id: string; fileName: string }[];
  textbookContent?: string;


}) {

  const {
    question,
    expandSearchOnline,
    language,
    imageBase64,
    history,
    chatId,
    availableBooks = [],
    textbookContent = '',
  } = args;
  console.log("📷 RECEIVED IMAGE:", imageBase64?.substring(0, 50));

  // Debug logging

  console.log("askQuestionAction called with:", {
    question,
    hasImage: !!imageBase64,
    historyLength: history?.length || 0,
    imageLength: imageBase64?.length || 0,
  });

  // ⚠️ تحويل historyItem إلى z.infer<typeof HistoryMessageSchema>[]
  // يجب أن يتم هذا التحويل هنا قبل تمريره إلى Flow
  const historyForAI = history.map(h => ({
    role: h.role,
    content: h.content,
    imageBase64: h.imageBase64,
  }));

  const input: AnswerStudyQuestionInput = {
    question,
    textbookContent,
    availableBooks,
    expandSearchOnline,
    language,
    // ⚠️ تجاوز مؤقت للنوع لتجنب خطأ TypeScript
    history: historyForAI as any,
    imageBase64: imageBase64 || undefined,
  };

  try {
    const output = await answerStudyQuestion(input);

    return {
      answer: output.answer,
      source: output.source,
      sourceBookName: output.sourceBookName,
      lang: output.lang,
      chatId: chatId ?? null,
    };

  } catch (error) {
    console.error('Error in Genkit flow:', error);
    return {
      answer: "حدث خطأ أثناء معالجة سؤالك. حاول لاحقًا.",
      source: "error",
      chatId,
    };
  }
}