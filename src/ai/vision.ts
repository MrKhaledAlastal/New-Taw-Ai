// src/ai/vision.ts
import { askFlash } from "./flash";

export async function askVision(
  systemPrompt: string,
  question: string,
  imageBase64?: string,
  pdfBase64?: string
): Promise<string> {
  // Delegate to askFlash which now handles multimodal inputs using Gemini 2.5 Flash
  return askFlash(systemPrompt, question, [], imageBase64, pdfBase64);
}

 