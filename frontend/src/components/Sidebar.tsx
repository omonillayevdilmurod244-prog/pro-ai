import type { Chat, AuthUser } from "../types";

interface Props {
  chats: Chat[];
  currentId: string | null;
  user: AuthUser;
  hidden: boolean;
  isDark: boolean;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onToggle: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  onContact: () => void;
  onInstall: () => void;
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Sidebar({
  chats,
  currentId,
  user,
  hidden,
  isDark,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onToggle,
  onLogout,
  onToggleTheme,
  onContact,
  onInstall,
}: Props) {
  return (
    <aside className={"sidebar" + (hidden ? " hidden" : "")}>
      <div className="side-top">
        <button className="icon-btn" onClick={onToggle} title="Yopish" aria-label="Yopish">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <button className="icon-btn theme-toggle-btn" onClick={onToggleTheme} title={isDark ? "Kunduzgi rejim" : "Tungi rejim"} aria-label={isDark ? "Kunduzgi rejim" : "Tungi rejim"}>
          <span className="theme-icon">{isDark ? <SunIcon /> : <MoonIcon />}</span>
        </button>
        <button className="icon-btn" onClick={onNewChat} title="Yangi chat" aria-label="Yangi chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <button className="new-chat" onClick={onNewChat}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Yangi chat
      </button>

      <div className="side-label">Chatlar tarixi</div>
      <div className="history">
        {chats.length === 0 && (
          <div className="history-empty">Hali chatlar yo'q</div>
        )}
        {chats.map((c) => (
          <div
            key={c.id}
            className={"hist-item" + (currentId === c.id ? " active" : "")}
            onClick={() => onSelectChat(c.id)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{c.title || "Yangi chat"}</span>
            <button
              className="del"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(c.id);
              }}
              title="O'chirish"
              aria-label="O'chirish"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="side-foot">
        <div className="user-chip">
          <div className="av">{(user.name || user.username).charAt(0).toUpperCase()}</div>
          <div className="nm">{user.name || user.username}</div>
        </div>

        <div className="foot-actions">
          <button className="foot-btn install-btn" onClick={onInstall} title="Ilovani o'rnatish (Yuklab olish)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Ilova
          </button>
          <button className="foot-btn" onClick={onContact} title="Aloqa">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Aloqa
          </button>
          <button className="foot-btn logout-btn" onClick={onLogout} title="Chiqish">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Chiqish
          </button>
        </div>
      </div>
    </aside>
  );
}
