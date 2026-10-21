import { useEffect, useState, useCallback } from "react";
import type { Chat, AuthUser } from "./types";
import { loadChats, saveChats, currentSession, logOut, getTheme, setTheme } from "./lib/storage";
import { sendChat, checkBackend } from "./lib/api";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import ChatThread from "./components/ChatThread";
import Composer from "./components/Composer";
import AiLogo from "./components/AiLogo";
import ContactModal from "./components/ContactModal";
import InstallModal from "./components/InstallModal";

const SYSTEM_PROMPT =
  "Sen proAI - aqlli va do'stona AI yordamchisan. Foydalanuvchi qanday tilda yozsa, o'sha tilda javob ber. Agar rasm yuborilsa, rasmni batafsil tahlil qilib ber. Markdown formatdan foydalanib, aniq va foydali javoblar ber.";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => currentSession());
  const [chats, setChats] = useState<Chat[]>(() => loadChats());
  const [currentId, setCurrentId] = useState<string | null>(chats[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = getTheme();
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  useEffect(() => {
    checkBackend().then((ok) => setBackendDown(!ok));
  }, []);

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    setTheme(theme);
  }, [isDark]);

  useEffect(() => {
    const saved = getTheme();
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
      setIsDark(saved === "dark");
    }
  }, []);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  if (!user) {
    return (
      <AuthScreen
        onAuth={(u) => {
          setUser(u);
          window.location.reload();
        }}
      />
    );
  }

  const currentChat = chats.find((c) => c.id === currentId) ?? null;

  function newChat() {
    setCurrentId(null);
  }

  function selectChat(id: string) {
    setCurrentId(id);
  }

  function deleteChat(id: string) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (currentId === id) setCurrentId(null);
  }

  function toggleTheme() {
    setIsDark((prev) => !prev);
  }

  const submit = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    const img = inputImage;

    // Faqat rasm bo'lsa ham yuborish mumkin
    if ((!text && !img) || busy) return;

    let chat = currentChat;
    let baseChats = chats;

    if (!chat) {
      const title = text.slice(0, 40) || "📷 Rasm tahlili";
      chat = { id: String(Date.now()), title, msgs: [] };
      baseChats = [chat, ...chats];
    }

    const userMsg = {
      role: "user" as const,
      content: text,
      ...(img ? { image: img } : {})
    };

    // Rasm bor, matn yo'q bo'lsa default so'rov
    const effectiveContent = text || (img ? "Rasmni tahlil qilib ber." : "");

    const updatedChat: Chat = {
      ...chat,
      title: chat.msgs.length
        ? chat.title
        : (text.slice(0, 40) || (img ? "📷 Rasm tahlili" : "Suhbat")),
      msgs: [...chat.msgs, userMsg, { role: "assistant" as const, content: "" }]
    };

    const finalChats = baseChats.map((c) => (c.id === updatedChat.id ? updatedChat : c));
    if (!baseChats.find((c) => c.id === updatedChat.id)) {
      finalChats.unshift(updatedChat);
    }

    setChats(finalChats);
    setCurrentId(updatedChat.id);
    setInput("");
    setInputImage(null);
    setBusy(true);

    const history = [...chat.msgs, { ...userMsg, content: effectiveContent }].slice(-14);
    const payload = [{ role: "system" as const, content: SYSTEM_PROMPT }, ...history];

    try {
      const reply = await sendChat(payload);

      if (!reply || reply.trim() === "") {
        setChats((prev) =>
          prev.map((c) =>
            c.id === updatedChat.id
              ? {
                  ...c,
                  msgs: c.msgs.map((m, i) =>
                    i === c.msgs.length - 1 ? { ...m, content: "*Bo'sh javob keldi. Qaytadan urinib ko'ring.*" } : m
                  )
                }
              : c
          )
        );
        return;
      }

      // Smooth typewriter animatsiyasi
      const totalLength = reply.length;
      const BASE_STEP = Math.max(2, Math.ceil(totalLength / 60));

      await new Promise<void>((resolve) => {
        let currentLength = 0;
        const timer = setInterval(() => {
          // Tezlikni dinamik qilish
          const remaining = totalLength - currentLength;
          const step = remaining < 50 ? 1 : BASE_STEP;
          currentLength = Math.min(currentLength + step, totalLength);

          const textChunk = reply.slice(0, currentLength);
          setChats((prev) =>
            prev.map((c) =>
              c.id === updatedChat.id
                ? {
                    ...c,
                    msgs: c.msgs.map((m, i) =>
                      i === c.msgs.length - 1 ? { ...m, content: textChunk } : m
                    )
                  }
                : c
            )
          );

          if (currentLength >= totalLength) {
            clearInterval(timer);
            resolve();
          }
        }, 16); // ~60fps
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Noma'lum xatolik yuz berdi";
      setChats((prev) =>
        prev.map((c) =>
          c.id === updatedChat.id
            ? {
                ...c,
                msgs: c.msgs.map((m, i) =>
                  i === c.msgs.length - 1
                    ? { ...m, content: `❌ **Xatolik:** ${msg}` }
                    : m
                )
              }
            : c
        )
      );
    } finally {
      setBusy(false);
    }
  }, [input, inputImage, busy, currentChat, chats]);

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        currentId={currentId}
        user={user}
        hidden={sidebarHidden}
        isDark={isDark}
        onNewChat={newChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onToggle={() => setSidebarHidden((v) => !v)}
        onLogout={() => {
          logOut();
          setUser(null);
        }}
        onToggleTheme={toggleTheme}
        onContact={() => setShowContact(true)}
        onInstall={() => setShowInstallModal(true)}
      />
      {showContact && <ContactModal user={user} onClose={() => setShowContact(false)} />}
      {showInstallModal && (
        <InstallModal
          deferredPrompt={deferredPrompt}
          onClose={() => setShowInstallModal(false)}
          onInstalled={() => {
            setIsInstalled(true);
            setShowInstallBanner(false);
          }}
        />
      )}
      <main className="main">
        <div className="topbar">
          {sidebarHidden && (
            <button
              className="icon-btn sidebar-reopen"
              onClick={() => setSidebarHidden(false)}
              title="Chatlar tarixini ochish"
              aria-label="Chatlar tarixini ochish"
            >
              ☰
            </button>
          )}
          <button className="brand">
            <AiLogo size={24} className="brand-icon" />
            <span>proAI</span>
          </button>

          {!isInstalled && (
            <button
              className="install-topbar-btn"
              onClick={() => setShowInstallModal(true)}
              title="Ilovani o'rnatish (Yuklab olish)"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Ilovani yuklash</span>
            </button>
          )}
        </div>

        {showInstallBanner && !isInstalled && (
          <div className="install-floating-banner">
            <div className="banner-content" onClick={() => setShowInstallModal(true)}>
              <span className="banner-icon">📱</span>
              <div className="banner-text">
                <strong>proAI ilovasini o'rnating!</strong>
                <span>Xuddi mobil ilovalardek to'liq ekranda tez va qulay ishlaydi</span>
              </div>
            </div>
            <div className="banner-actions">
              <button className="banner-install-btn" onClick={() => setShowInstallModal(true)}>
                Yuklab olish
              </button>
              <button
                className="banner-close-btn"
                onClick={() => setShowInstallBanner(false)}
                title="Yopish"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {backendDown && (
          <div className="backend-warn">
            ⚠️ Backend serverga ulanib bo'lmadi. <strong>backend-node</strong> papkasida <code>node server.js</code> buyrug'ini ishga tushiring.
          </div>
        )}
        <ChatThread chat={currentChat} busy={busy} onSuggestion={(t) => submit(t)} />
        <Composer
          value={input}
          image={inputImage}
          busy={busy}
          onChange={setInput}
          onImageChange={setInputImage}
          onSubmit={() => submit()}
        />
      </main>
    </div>
  );
}
