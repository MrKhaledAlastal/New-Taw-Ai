"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  Globe,
  Book,
  Paperclip,
  Send,
  X,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";

import { collection, orderBy, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createChat, saveMessage } from "@/lib/firestore";

import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";

import { storage } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import { compressDataUrl } from "@/lib/utils";
import { Logo } from "../icons/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";
import { askQuestionAction } from "@/app/actions";

// =========================================================
// Interface
// =========================================================

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  sourceBookName?: string;
  imageBase64?: string | null; // ✔ الحقل المحلي (من Firestore)
  lang?: "ar" | "en";
}

// =========================================================
// Main Chat Component
// =========================================================

export default function ChatInterface() {
  console.log("🔥 ChatInterface LOADED — VERSION 7");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [expandSearch, setExpandSearch] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { t, lang } = useLanguage();
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const searchParams = useSearchParams();
  const initialChatId = searchParams.get("chatId");
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    initialChatId
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // =========================================================
  // Handle initial chatId
  // =========================================================

  useEffect(() => {
    setCurrentChatId(initialChatId || null);
  }, [initialChatId]);

  // =========================================================
  // Dropzone for image upload
  // =========================================================

  const onFileDrop = (files: File[]) => {
    console.log("🔥 DROPZONE FIRED");

    const file = files[0];
    if (!file) {
      console.log("❌ لا يوجد ملف");
      return;
    }

    console.log("📸 File picked:", file.name, file.type, file.size);

    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      console.log("📸 FILE READER RESULT:", result?.toString().substring(0, 100));

      setAttachedImage(result as string);
    };

    reader.onerror = () => console.log("❌ FileReader FAILED");

    reader.readAsDataURL(file);
  };


  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: onFileDrop,
    noClick: true,
    noKeyboard: true,
  });

  // =========================================================
  // Firestore Listener — Load Messages
  // =========================================================

  useEffect(() => {
    if (!user || !currentChatId) return;

    const ref = collection(
      db,
      "users",
      user.uid,
      "chats",
      currentChatId,
      "messages"
    );

    const q = query(ref, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          role: d.role,
          content: d.content,
          imageBase64: d.imageDataUri || undefined, // ✔ خريطة من Firebase: imageDataUri → imageBase64
          source: d.source,
          sourceBookName: d.sourceBookName,
          lang: d.lang,
        } as Message;
      });

      setMessages(arr);
    });

    return () => unsub();
  }, [user, currentChatId]);

  // =========================================================
  // Auto Scroll
  // =========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAssistantTyping]);

  // =========================================================
  // Send Message
  // =========================================================

  const sendMessage = () => {
    const msg = input.trim();
    if ((!msg && !attachedImage) || isPending) return;

    if (!isLoggedIn || !user) return router.push("/login?redirect=/chat");

    const uid = user.uid;

    setInput("");
    const img = attachedImage;
    console.log("📦 BEFORE SEND — attachedImage =", img?.substring?.(0, 80));

    console.log("📸 UI SEND — attachedImage =", img?.substring(0, 80));

    setAttachedImage(null);
    setIsAssistantTyping(true);

    startTransition(async () => {
      try {
        // Create chat
        let chatId = currentChatId;
        if (!chatId) {
          chatId = await createChat(uid, msg || "صورة");
          setCurrentChatId(chatId);
          router.replace(`/chat?chatId=${chatId}`);
        }

        // Upload image
        let uploadedImageUrl: string | undefined = undefined;

        if (img) {
          try {
            const compressed = await compressDataUrl(img, 1200, 0.8);
            const path = `users/${uid}/uploads/${Date.now()}.jpg`;
            const ref = storageRef(storage, path);

            await uploadString(ref, compressed, "data_url");
            uploadedImageUrl = await getDownloadURL(ref);

            console.log("📤 Uploaded image URL:", uploadedImageUrl);
          } catch (err) {
            console.log("❌ Upload failed, using Data URI instead");
          }
        }

        await saveMessage(uid, chatId!, {
          role: "user",
          content: msg,
          imageDataUri: uploadedImageUrl || img || null,
        });

        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
          imageBase64: m.imageBase64 || null,
        }));


        // ⬅️ المهم: تحديد الصورة التي سترسل للذكاء
        const finalImage = img ?? undefined;


        console.log(
          "📡 FINAL imageBase64 SENT TO AI:",
          finalImage?.substring?.(0, 80)
        );

        const result = await askQuestionAction({
          question: msg,
          expandSearchOnline: expandSearch,
          language: lang,
          userId: uid,
          chatId,
          imageBase64: finalImage, // ← أهم جزء
          history: history as any,
        });

        console.log("🤖 AI Response:", result);

        await saveMessage(uid, chatId!, {
          role: "assistant",
          content: result.answer,
          source: result.source,
          sourceBookName: result.sourceBookName,
          lang: result.lang,
        });

      } catch (e) {
        console.error("Critical Error during sendMessage transition:", e);
      } finally {
        setIsAssistantTyping(false);
      }
    });
  };


  // =========================================================
  // UI — Messages Rendering
  // =========================================================

  return (
    <div className="flex flex-col h-full w-full">
      {/* Messages Container - Full Width */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-32 opacity-80">
              {/* Logo */}
              <div className="mb-6">
                <img
                  src="/logo.png"
                  alt="AI Logo"
                  className="h-20 w-20 opacity-90"
                />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold mb-3">
                {lang === "ar"
                  ? "مرحباً بك في Tawjihi AI"
                  : "Welcome to Tawjihi AI"}
              </h1>

              {/* Description */}
              <p className="text-muted-foreground max-w-md mb-8 leading-relaxed text-sm">
                {lang === "ar"
                  ? "ابدأ المحادثة بسؤالك عن أي درس أو قاعدة أو موضوع من كتب التوجيهي، أو قم برفع صورة لصفحة من الكتاب لشرحها لك."
                  : "Start asking about any topic from your textbooks, or upload an image of a page to get explanations instantly."}
              </p>

              {/* Example bubbles */}
              <div className="grid gap-3 max-w-md w-full">
                {[
                  lang === "ar"
                    ? "اشرحلي قاعدة الماضي البسيط"
                    : "Explain the present simple tense",
                  lang === "ar"
                    ? "لخصلي درس الخلية في الأحياء"
                    : "Summarize the cell chapter in Biology",
                  lang === "ar"
                    ? "حللي القطعة التالية"
                    : "Solve this reading passage",
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(ex)}
                    className="
  w-full text-left px-4 py-3 rounded-xl
  bg-muted/50
  border border-transparent
  hover:border-primary/40
  transition-all duration-300 ease-out
  hover:shadow-[0_0_8px_rgba(0,255,0,0.35)]
  text-sm
"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isAssistant = m.role === "assistant";
            const dir =
              m.lang === "ar" || /[\u0600-\u06FF]/.test(m.content || "")
                ? "rtl"
                : "ltr";

            return (
              <div
                key={m.id}
                className={cn(
                  "flex w-full my-4",
                  isAssistant ? "justify-start" : "justify-end"
                )}
              >
                {isAssistant ? (
                  // ============================
                  //    Assistant Message (Left-aligned with avatar)
                  // ============================
                  <div className="flex items-start gap-3 max-w-[75%]">
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                      <AvatarImage src="/logo.png" />
                      <AvatarFallback>
                        <img src="/logo.png" alt="AI" className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Card */}
                    <div
                      dir={dir}
                      className={cn(
                        "group relative flex-1 rounded-2xl px-5 py-4 shadow-sm border transition-all",
                        "bg-background/60 backdrop-blur-sm border-border/40",
                        "hover:shadow-md hover:bg-background/70",
                        dir === "rtl" ? "text-right" : "text-left"
                      )}
                    >
                      {/* Header */}
                      <div
                        className={cn(
                          "flex items-center gap-2 mb-3",
                          dir === "rtl" && "flex-row-reverse"
                        )}
                      >
                        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-xs font-semibold text-primary/80">
                          {m.lang === "ar"
                            ? "توضيح متقدم"
                            : "Enhanced Explanation"}
                        </span>
                      </div>

                      {/* Image (if present) */}
                      {m.imageBase64 && (
                        <img
                          src={m.imageBase64}
                          alt="Assistant content"
                          className="rounded-lg mb-3 border border-border/40 
                max-w-[260px] max-h-[260px] object-contain"
                        />
                      )}

                      {/* Content */}
                      <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/95">
                        {m.content}
                      </div>

                      {/* Source (if present) */}
                      {m.source && (
                        <div
                          className={cn(
                            "mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground flex items-center gap-1",
                            dir === "rtl" && "flex-row-reverse"
                          )}
                        >
                          {m.source === "web" && (
                            <Globe className="h-3 w-3 flex-shrink-0" />
                          )}
                          {m.source === "textbook" && (
                            <Book className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span>
                            {m.source === "web" && "Source: Web"}
                            {m.source === "textbook" &&
                              (m.sourceBookName
                                ? `Source: ${m.sourceBookName}`
                                : "Source: Textbook")}
                          </span>
                        </div>
                      )}

                      {/* Copy button - محسّن */}
                      {/* Copy button - للجوال والديسكتوب */}
                      <button
                        dir="ltr" // 🔥 يجعل الزر يتجاهل RTL ويثبت إلى اليمين دائماً
                        onClick={() => {
                          navigator.clipboard.writeText(m.content);
                          setCopiedId(m.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className={cn(
                          "absolute top-2 right-3 p-1.5 rounded-md transition-all",
                          "bg-background/80 hover:bg-background",
                          "border border-border/40 hover:border-border",
                          "shadow-sm hover:shadow",
                          copiedId === m.id
                            ? "opacity-100"
                            : "opacity-60 hover:opacity-100"
                        )}
                      >
                        {copiedId === m.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // ============================
                  //    User Message (Right-aligned bubble)
                  // ============================
                  <div
                    dir={dir}
                    className={cn(
                      "max-w-[75%] px-4 py-3 rounded-2xl shadow-sm",
                      "bg-primary text-primary-foreground",
                      "whitespace-pre-wrap leading-relaxed",
                      dir === "rtl" ? "rounded-tr-sm" : "rounded-br-sm"
                    )}
                  >
                    {m.imageBase64 && (
                      <img
                        src={m.imageBase64}
                        alt="User content"
                        className="rounded-lg mb-2 border border-primary-foreground/20 
                max-w-[260px] max-h-[260px] object-contain"
                      />
                    )}

                    <div className="text-[15px]">{m.content}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isAssistantTyping && (
            <div className="flex w-full justify-start my-4">
              <div className="flex items-start gap-3 max-w-[75%]">
                <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                  <AvatarImage src="/logo.png" />
                  <AvatarFallback>
                    <img src="/logo.png" alt="AI" className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-sm border border-border/40">
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Centered with max-width */}
      <div className="w-full ">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {attachedImage && (
            <div className="relative inline-block mb-3">
              <img
                src={attachedImage}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5"
                onClick={() => setAttachedImage(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div {...getRootProps()}>
            <input {...getInputProps()} />

            <div className="flex items-end gap-2 rounded-2xl bg-background border border-border p-2 focus-within:ring-2 focus-within:ring-primary transition-shadow">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={open}
                className="h-9 w-9 hover:bg-muted flex-shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.chatPlaceholder || "اكتب سؤالك..."}
                className="flex-1 bg-transparent text-sm px-2 py-2 resize-none max-h-40 outline-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />

              <Button
                type="button"
                size="icon"
                className="h-9 w-9 bg-primary hover:bg-primary/90 flex-shrink-0"
                disabled={isPending || (!input.trim() && !attachedImage)}
                onClick={sendMessage}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-3">
            <Switch checked={expandSearch} onCheckedChange={setExpandSearch} />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              {t.expandSearch || "Expand search"}
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
