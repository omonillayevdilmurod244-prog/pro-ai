import { useState, useRef, useEffect } from "react";
import { sendContactMessage, getContactMessages } from "../lib/api";

interface ContactMsg {
  id: string;
  role: 'user' | 'admin';
  content: string;
  image?: string;
}

interface Props {
  onClose: () => void;
}

export default function ContactModal({ onClose }: Props) {
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [name, setName] = useState("Foydalanuvchi");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMsgs = async () => {
      try {
        const msgs = await getContactMessages();
        setMessages(msgs);
      } catch (e) {}
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    if (!text.trim() && !image) return;
    setSending(true);
    try {
      await sendContactMessage(name, text, image);
      setText("");
      setImage(null);
      // Tezroq ko'rsatish uchun lokal history ni yangilaymiz
      const msgs = await getContactMessages();
      setMessages(msgs);
    } catch (err: any) {
      alert("Xatolik: " + (err.message || "Ulanishda muammo"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 700, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Jonli Aloqa</h2>
          <button onClick={onClose} style={{ fontSize: 24, color: 'var(--text-muted)' }}>✕</button>
        </div>
        
        <div className="contact-chat">
          <div className="contact-history" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="c-empty">Hali xabarlar yo'q. Savolingizni yozing!</div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`c-msg ${m.role}`}>
                  {m.role === 'admin' && <strong style={{display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 4}}>Admin (proAI)</strong>}
                  {m.content}
                  {m.image && <img src={m.image} alt="Yuborilgan rasm" />}
                </div>
              ))
            )}
            {sending && <div className="c-msg user" style={{opacity: 0.6}}>Yuborilmoqda...</div>}
          </div>

          <form onSubmit={handleSubmit}>
            {image && (
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, padding: "8px 12px", background: "rgba(79, 110, 247, 0.1)", borderRadius: 10 }}>
                <img src={image} alt="Tanlangan rasm" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Rasm tayyor</div>
                <button type="button" onClick={() => setImage(null)} style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            <div className="c-input-row">
              <input type="file" accept="image/*" style={{ display: "none" }} ref={fileRef} onChange={handleFileChange} />
              <button type="button" onClick={() => fileRef.current?.click()} className="icon-btn" style={{ background: 'var(--composer)', border: '1px solid var(--border)', flexShrink: 0 }}>
                📎
              </button>
              <textarea 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Xabar yozing..." 
                disabled={sending} 
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button type="submit" className="btn-send" disabled={sending || (!text.trim() && !image)}>
                ➤
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
