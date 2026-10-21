import { useState, useRef, useEffect } from "react";
import { sendContactMessage, getContactMessages } from "../lib/api";
import type { AuthUser } from "../types";

interface ContactMsg {
  id: string;
  role: "user" | "admin";
  content: string;
  image?: string;
  time?: string;
}

interface Props {
  user: AuthUser | null;
  onClose: () => void;
}

const STORAGE_KEY = "proai_contact_chat_history";

export default function ContactModal({ user, onClose }: Props) {
  const [messages, setMessages] = useState<ContactMsg[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "welcome",
        role: "admin",
        content: "Assalomu alaykum! proAI qo'llab-quvvatlash xizmatiga xush kelibsiz. Savol yoki taklifingizni yozing, admin tez orada javob beradi.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayName = user ? `${user.name || user.username} (@${user.username})` : "Foydalanuvchi";

  // Tarixni saqlash
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Yangi admin xabarlarini tekshirish
  useEffect(() => {
    let mounted = true;
    const fetchMsgs = async () => {
      try {
        const remoteMsgs = await getContactMessages();
        if (mounted && remoteMsgs && remoteMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const fresh = remoteMsgs.filter((m: any) => !existingIds.has(m.id));
            if (fresh.length === 0) return prev;
            return [...prev, ...fresh];
          });
        }
      } catch {}
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Faqat rasm tanlang.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === "string") {
          setImage(evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content && !image) return;

    const newMsg: ContactMsg = {
      id: String(Date.now()),
      role: "user",
      content: content || "",
      image: image || undefined,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    // Darhol ekranda ko'rsatamiz va saqlaymiz
    setMessages((prev) => [...prev, newMsg]);
    setText("");
    setImage(null);
    setSending(true);
    setStatusNotice(null);

    try {
      await sendContactMessage(displayName, content, newMsg.image || null);
      setStatusNotice("✅ Xabaringiz adminga yetkazildi!");

      // 1.5 soniyadan keyin avtomatik tasdiq
      setTimeout(() => {
        setMessages((prev) => {
          const hasAck = prev.some((m) => m.id === "auto_ack_" + newMsg.id);
          if (hasAck) return prev;
          return [
            ...prev,
            {
              id: "auto_ack_" + newMsg.id,
              role: "admin",
              content: "Xabaringiz qabul qilindi. Tez orada ko'rib chiqib javob yozamiz!",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
          ];
        });
      }, 1500);
    } catch (err: any) {
      setStatusNotice("⚠️ Xabar saqlandi, lekin Telegramga yuborishda: " + (err.message || "xatolik"));
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    if (confirm("Aloqa yozishmalarini tozalamoqchimisiz?")) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="contact-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="contact-header">
          <div className="contact-header-info">
            <div className="admin-avatar">
              <span>👨‍💻</span>
              <span className="online-indicator"></span>
            </div>
            <div>
              <h3>Admin bilan Aloqa</h3>
              <p className="online-text">
                <span className="dot"></span> Jonli yordam • Tezkor javob
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-btn-sm" onClick={clearChat} title="Tarixni tozalash">
              🗑️
            </button>
            <button className="icon-btn-sm" onClick={onClose} title="Yopish">
              ✕
            </button>
          </div>
        </div>

        {/* Telegram Direct Link Banner */}
        <div className="telegram-contact-bar">
          <span>✈️ Telegram bot:</span>
          <a
            href="https://t.me/proai_aloqa_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="telegram-link"
          >
            @proai_aloqa_bot
          </a>
        </div>

        {/* Chat History */}
        <div className="contact-chat-body" ref={scrollRef}>
          {messages.map((m) => (
            <div key={m.id} className={`contact-bubble ${m.role}`}>
              {m.role === "admin" && (
                <div className="bubble-author">
                  <span>🛡️ proAI Admin</span>
                  {m.time && <span className="bubble-time">{m.time}</span>}
                </div>
              )}
              {m.image && (
                <div className="bubble-img-wrap">
                  <img src={m.image} alt="Biriktirilgan rasm" />
                </div>
              )}
              {m.content && <div className="bubble-text">{m.content}</div>}
              {m.role === "user" && m.time && (
                <div className="bubble-time-user">{m.time} ✓</div>
              )}
            </div>
          ))}

          {sending && (
            <div className="contact-bubble user sending">
              <span className="sending-dots">Yuborilmoqda...</span>
            </div>
          )}
        </div>

        {/* Status Notice */}
        {statusNotice && <div className="contact-status-notice">{statusNotice}</div>}

        {/* Composer Form */}
        <form onSubmit={handleSubmit} className="contact-form">
          {image && (
            <div className="contact-image-preview">
              <img src={image} alt="Biriktirilgan" />
              <span>Rasm biriktirildi</span>
              <button type="button" onClick={() => setImage(null)}>
                ✕
              </button>
            </div>
          )}

          <div className="contact-input-row">
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              ref={fileRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="contact-attach-btn"
              onClick={() => fileRef.current?.click()}
              title="Rasm biriktirish"
            >
              📎
            </button>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Xabaringizni yozing..."
              disabled={sending}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            <button
              type="submit"
              className="contact-send-btn"
              disabled={sending || (!text.trim() && !image)}
              title="Yuborish"
            >
              ➤
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
