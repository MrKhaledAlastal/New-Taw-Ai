import { ai } from "@/ai/genkit";

export async function askPro(systemPrompt: string, question: string, history: any[] = []) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question },
  ];

  const resp = await (ai as any).generate({
    model: "googleai/models/gemini-2.5-pro",
    messages,
  });

  return resp.outputText();
}
