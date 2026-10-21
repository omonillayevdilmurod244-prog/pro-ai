import type { Message } from "../types";

function inferApiUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  const { hostname, origin } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return origin;
  }
  return "http://localhost:8000";
}

const API_URL = import.meta.env.VITE_API_URL || inferApiUrl();

export async function checkBackend(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_URL}/api/health`, { method: "GET" });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function sendChat(messages: Message[], signal?: AbortSignal): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal
    });
  } catch {
    throw new Error(
      `Backendga ulanib bo'lmadi (${API_URL}). Server ishga tushirilganini va manzil to'g'riligini tekshiring.`
    );
  }

  let data: { reply?: string; detail?: string };
  try {
    data = await resp.json();
  } catch {
    throw new Error(`Serverdan noto'g'ri javob keldi (status ${resp.status}).`);
  }

  if (!resp.ok) {
    throw new Error(data.detail || "Server xatosi");
  }

  return data.reply || "";
}

export async function sendContactMessage(name: string, message: string, image: string | null): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, image }),
    });
  } catch {
    throw new Error("Serverga ulanib bo'lmadi.");
  }
  
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || "Xabar yuborishda xatolik");
  }
  return data.detail || "Muvaffaqiyatli";
}

export async function getContactMessages(): Promise<any[]> {
  const resp = await fetch(`${API_URL}/api/contact`);
  if (!resp.ok) return [];
  return await resp.json();
}
