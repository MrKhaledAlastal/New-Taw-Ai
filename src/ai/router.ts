import { askFlash } from "./flash";

export interface AskAIInput {
  question: string;
  system: string;
  history?: { role: "user" | "assistant"; content: string; imageBase64?: string }[];
  imageBase64?: string;
  pdfBase64?: string;
}

export async function askAI({
  question,
  system,
  history = [],
  imageBase64,
  pdfBase64,
}: AskAIInput): Promise<string> {

  console.log("askAI called with:", {
    question,
    hasImage: !!imageBase64,
    historyLength: history?.length || 0,
    imageLength: imageBase64?.length || 0,
  });

  // 🟥 Log إضافي مهم جداً
  if (imageBase64) {
    console.log("🟥 ROUTER RECEIVED IMAGE BASE64 (first 80 chars):", imageBase64.substring(0, 80));
  } else {
    console.log("🟥 ROUTER RECEIVED NO IMAGE");
  }

  return askFlash(system, question, history, imageBase64, pdfBase64);
}
