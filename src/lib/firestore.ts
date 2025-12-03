import { db } from "./firebase";
import {
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc
} from "firebase/firestore";

// حفظ المستخدم (يُستدعى أول مرة عند تسجيل الدخول)
export async function saveUser(user: any) {
  if (!user?.uid) return;
  const userRef = doc(db, "users", user.uid);
  await setDoc(
    userRef,
    {
      email: user.email || "",
      name: user.displayName || "مستخدم جديد",
      lastLogin: serverTimestamp(),
    },
    { merge: true }
  );
}

// إنشاء محادثة جديدة
export async function createChat(userId: string, firstMessage?: string) {
  const chatsRef = collection(db, "users", userId, "chats");

  const hasMessage = Boolean(firstMessage?.trim());
  const safeTitle = hasMessage
    ? firstMessage!.substring(0, 50)
    : "New chat";
  const preview = hasMessage ? firstMessage!.substring(0, 80) : "";

  const chatDoc = await addDoc(chatsRef, {
    title: safeTitle,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: preview,
  });
  return chatDoc.id;
}

export type ChatMessagePayload = {
  role: "user" | "assistant";
  content: string;
  imageDataUri?: string | null;
  source?: string;
  sourceBookName?: string;
  lang?: "ar" | "en";
};

// حفظ رسالة داخل محادثة
export async function saveMessage(userId: string, chatId: string, message: ChatMessagePayload) {
  const messagesRef = collection(db, "users", userId, "chats", chatId, "messages");
  await addDoc(messagesRef, {
    role: message.role,
    content: message.content,
    ...(message.imageDataUri ? { imageDataUri: message.imageDataUri } : {}),
    ...(message.source ? { source: message.source } : {}),
    ...(message.sourceBookName ? { sourceBookName: message.sourceBookName } : {}),
    ...(message.lang ? { lang: message.lang } : {}),
    createdAt: serverTimestamp(),
  });

  const chatRef = doc(db, "users", userId, "chats", chatId);
  const chatUpdate: Record<string, any> = {
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  };

  if (message.content) {
    chatUpdate.lastMessagePreview = message.content.substring(0, 80);
  }

  if (message.role === "user" && message.content?.trim()) {
    chatUpdate.title = message.content.substring(0, 50);
  }

  await setDoc(chatRef, chatUpdate, { merge: true });
}

// جلب جميع المحادثات للمستخدم
export async function getUserChats(userId: string) {
  const chatsRef = collection(db, "users", userId, "chats");
  const q = query(chatsRef, orderBy("lastMessageAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// حذف محادثة
export async function deleteChat(userId: string, chatId: string) {
  const chatRef = doc(db, "users", userId, "chats", chatId);
  await deleteDoc(chatRef);
}

// إعادة تسمية محادثة
export async function renameChat(userId: string, chatId: string, newTitle: string) {
  const chatRef = doc(db, "users", userId, "chats", chatId);
  await setDoc(chatRef, { title: newTitle, updatedAt: serverTimestamp() }, { merge: true });
}
