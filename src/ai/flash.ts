// src/ai/flash.ts
import { ai } from "@/ai/genkit";

function extractText(resp: any): string {
  return (
    resp?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text ||
    resp?.candidates?.[0]?.content?.[0]?.text ||
    resp?.text ||
    ""
  );
}

// Function to determine content type from data URL
function getContentTypeFromDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);/);
    return match ? match[1] : 'image/jpeg';
  }
  // If it's a URL, try to determine content type from extension
  if (dataUrl.includes('.')) {
    const ext = dataUrl.split('.').pop()?.split('?')[0]?.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      default: return 'image/jpeg';
    }
  }
  return 'image/jpeg';
}

export async function askFlash(
  systemPrompt: string,
  question: string,
  history: { role: "user" | "assistant"; content: string; imageBase64?: string }[] = [],
  imageOrUrl?: string,
  pdfOrUrl?: string
): Promise<string> {
  const hasMedia = !!(imageOrUrl || pdfOrUrl);
  const isUrl = (s: string) => /^https?:\/\//i.test(s);

  // Debug logging
  console.log("askFlash called with:", {
    hasQuestion: !!question,
    hasImage: !!imageOrUrl,
    hasPdf: !!pdfOrUrl,
    historyLength: history?.length || 0,
    imageLength: imageOrUrl?.length || 0,
  });
  if (imageOrUrl) {
    console.log("🟦 FLASH RECEIVED IMAGE (first 80 chars):", imageOrUrl.substring(0, 80));
  } else {
    console.log("🟥 FLASH RECEIVED NO IMAGE");
  }

  const messages: any[] = [];

  /* Add system prompt */
  if (systemPrompt?.trim()) {
    messages.push({
      role: "system",
      content: [{ text: systemPrompt.trim() }],
    });
  }

  /* Add history */
  for (const m of history) {
    const txt = m.content?.trim();
    if (!txt && !m.imageBase64) continue;

    const userContent: any[] = [];

    // Add text content if present
    if (txt) {
      userContent.push({ text: txt });
    }

    // Add image to history message if present
    if (m.imageBase64) {
      const contentType = getContentTypeFromDataUrl(m.imageBase64) || 'image/jpeg';
      userContent.push({
        media: {
          url: isUrl(m.imageBase64)
            ? m.imageBase64
            : m.imageBase64.startsWith('data:')
              ? m.imageBase64
              : `data:${contentType};base64,${m.imageBase64}`,
          contentType: contentType,
        },
      });
    }

    messages.push({
      role: m.role === "assistant" ? "model" : "user",
      content: userContent,
    });
  }

  /* Add user question with media (if present) */
  const q = question?.trim();
  if (q || hasMedia) {
    const userContent: any[] = [];

    if (q) {
      userContent.push({ text: q });
    }

    if (imageOrUrl) {
      const contentType = getContentTypeFromDataUrl(imageOrUrl) || 'image/jpeg';
      userContent.push({
        media: {
          url: isUrl(imageOrUrl)
            ? imageOrUrl
            : imageOrUrl.startsWith('data:')
              ? imageOrUrl
              : `data:${contentType};base64,${imageOrUrl}`,
          contentType: contentType,
        },
      });
    }

    if (pdfOrUrl) {
      userContent.push({
        media: {
          url: isUrl(pdfOrUrl)
            ? pdfOrUrl
            : `data:application/pdf;base64,${pdfOrUrl}`,
          contentType: "application/pdf",
        },
      });
    }

    messages.push({
      role: "user",
      content: userContent,
    });
  }

  // Log the complete messages array for debugging
  console.log("Messages being sent to AI:", JSON.stringify(messages, null, 2));
  messages.forEach((msg, i) => {
    console.log(`🔍 MSG[${i}]`, {
      role: msg.role,
      hasMedia: !!msg.content.find((c: any) => c.media),
      mediaPreview: msg.content
        .filter((c: any) => c.media)
        .map((c: any) => c.media.url.substring(0, 80)),
    });
  });

  console.log("🟩 FINAL MEDIA CHECK:", {
    imageInLastMessage: messages[messages.length - 1]?.content?.find((c: any) => c.media),
    hasMediaInFinal: !!messages[messages.length - 1]?.content?.find((c: any) => c.media),
  });

  try {
    const resp = await (ai as any).generate({
      model: "googleai/gemini-2.5-flash",
      messages,
    });

    const text = extractText(resp);
    console.log("askFlash response:", {
      hasResponse: !!text,
      textLength: text?.length || 0,
      responseKeys: Object.keys(resp || {}),
    });

    return text || "No response received.";
  } catch (err: any) {
    console.error("askFlash error:", err?.message || err);
    throw err;
  }
}