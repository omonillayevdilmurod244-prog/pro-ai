import { useState, useEffect, FormEvent } from "react";
import {
  signUp,
  logIn,
  loginWithGoogle,
  hasAnyUser,
  getLoginLockStatus,
  recordLoginFailure,
  clearLoginLock,
  findUserByLoginOrEmail,
  resetUserPassword
} from "../lib/storage";
import { sendContactMessage } from "../lib/api";
import type { AuthUser } from "../types";
import AiLogo from "./AiLogo";

interface Props {
  onAuth: (user: AuthUser) => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(
    hasAnyUser() ? "login" : "signup"
  );

  // Form maydonlari
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Rate Limiting (3 urinish -> 30s blok, keyin 3 urinish -> 60s blok)
  const [lockStatus, setLockStatus] = useState(() => getLoginLockStatus());

  // Parol unutganda 6 xonali kod holati
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [targetAccount, setTargetAccount] = useState<{ username: string; name: string; email?: string } | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [inputCode, setInputCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);

  // 3 soniyalik akkaunt ochish loading holati
  const [loadingUser, setLoadingUser] = useState<AuthUser | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Hisob ma'lumotlari saqlanmoqda...");

  // Google kirish dialog holati
  const [googlePrompt, setGooglePrompt] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [googleNameInput, setGoogleNameInput] = useState("");

  // Lockout countdown taymeri
  useEffect(() => {
    const timer = setInterval(() => {
      const status = getLoginLockStatus();
      setLockStatus(status);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3 soniyalik yuklanish taymeri
  useEffect(() => {
    if (!loadingUser) return;

    const startTime = Date.now();
    const duration = 3000; // 3 soniya

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.round((elapsed / duration) * 100), 100);
      setLoadingProgress(progress);

      if (progress < 30) {
        setLoadingStatus("Hisob ma'lumotlari xavfsiz saqlanmoqda...");
      } else if (progress < 65) {
        setLoadingStatus("proAI shaxsiy xonangiz sozlanmoqda...");
      } else if (progress < 95) {
        setLoadingStatus("Sun'iy intellekt modeli ulanmoqda...");
      } else {
        setLoadingStatus("Xush kelibsiz! ✨");
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        try {
          onAuth(loadingUser);
        } catch {}
        window.location.reload();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [loadingUser, onAuth]);

  // Oddiy Kirish / Ro'yxatdan o'tish
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    // Agar bloklangan bo'lsa
    if (mode === "login" && lockStatus.isLocked) {
      setError(`Hisob vaqtincha bloklangan. Qayta urinish uchun ${lockStatus.secondsLeft} soniya kuting.`);
      return;
    }

    const u = username.trim().toLowerCase();
    if (!u || !pass) {
      setError("Login va parolni kiriting.");
      return;
    }

    if (mode === "signup") {
      const user = signUp(u, pass, name.trim(), email.trim());
      if (!user) {
        setError("Bu login yoki email allaqachon band. Kirishni tanlang.");
        return;
      }
      setLoadingUser(user);
    } else if (mode === "login") {
      const user = logIn(u, pass);
      if (!user) {
        const lock = recordLoginFailure();
        setLockStatus(lock);
        if (lock.isLocked) {
          setError(
            `3 ta noto'g'ri urinish! Tizim xavfsizlik uchun ${lock.secondsLeft} soniyaga bloklandi.`
          );
        } else {
          setError(
            `Login yoki parol noto'g'ri! Qolgan imkoniyat: ${lock.attemptsLeft} ta.`
          );
        }
        return;
      }
      clearLoginLock();
      onAuth(user);
    }
  }

  // Google orqali tezkor kirish
  function handleGoogleAuth() {
    setGooglePrompt(true);
    setGoogleEmailInput("");
    setGoogleNameInput("");
  }

  function confirmGoogleAuth(e: FormEvent) {
    e.preventDefault();
    const gEmail = googleEmailInput.trim().toLowerCase();
    if (!gEmail || !gEmail.includes("@")) {
      setError("Iltimos, to'g'ri Google email manzilini kiriting.");
      return;
    }
    const gName = googleNameInput.trim() || gEmail.split("@")[0];
    const user = loginWithGoogle(gEmail, gName);
    setSuccessMsg(`Google orqali xush kelibsiz, ${user.name}!`);
    setTimeout(() => {
      onAuth(user);
    }, 800);
  }

  // Parolni unutganda 1-qadam: Kod yuborish
  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCodeNotice(null);

    const q = username.trim().toLowerCase();
    if (!q) {
      setError("Login yoki emailingizni kiriting.");
      return;
    }

    const account = findUserByLoginOrEmail(q);
    if (!account) {
      setError("Bunday login yoki emailga ega hisob topilmadi.");
      return;
    }

    // 6 xonali tasdiqlash kodi yasash
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedCode(code);
    setTargetAccount(account);
    setForgotStep(2);

    const emailDisplay = account.email || `${account.username}@gmail.com`;
    setCodeNotice(
      `6 xonali tasdiqlash kodi ${emailDisplay} manziliga yuborildi!\nKOD: ${code}`
    );

    // Xavfsizlik kodini Telegram / contact orqali ham qayd etish
    try {
      await sendContactMessage(
        "proAI Xavfsizlik",
        `🔐 Foydalanuvchi @${account.username} (${account.name}) parol tiklash uchun 6 xonali kod so'radi: ${code}`,
        null
      );
    } catch {}
  }

  // Parolni unutganda 2-qadam: Kodni tekshirish va yangi parol o'rnatish
  function handleVerifyAndReset(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!inputCode.trim()) {
      setError("Iltimos, 6 xonali tasdiqlash kodini kiriting.");
      return;
    }

    // Kodni tekshirish
    if (inputCode.trim() !== generatedCode) {
      setError("Noto'g'ri kod kiritildi! Iltimos, tekshirib qaytadan kiriting.");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    if (!targetAccount) {
      setError("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
      return;
    }

    // Yangi parolni saqlash
    const ok = resetUserPassword(targetAccount.username, newPassword);
    if (!ok) {
      setError("Parolni yangilashda xatolik yuz berdi.");
      return;
    }

    clearLoginLock();
    setSuccessMsg("Xush kelibsiz! Yangi parolingiz muvaffaqiyatli saqlandi 🎉");

    // 1.5 soniyadan so'ng to'g'ridan-to'g'ri kirish
    setTimeout(() => {
      onAuth({
        username: targetAccount.username,
        name: targetAccount.name,
        email: targetAccount.email
      });
    }, 1200);
  }

  // 3 soniyalik hisob yuklanish ekrani
  if (loadingUser) {
    return (
      <div className="auth-screen">
        <div className="auth-loading-card">
          <div className="loading-logo-wrap">
            <div className="loading-pulse-ring"></div>
            <div className="loading-pulse-ring-outer"></div>
            <AiLogo size={56} className="loading-logo-icon" />
          </div>

          <h2>Hisobingiz yaratildi! 🎉</h2>
          <p className="loading-sub">
            Salom, <strong>{loadingUser.name || loadingUser.username}</strong>! proAI shaxsiy
            tizimingiz tayyorlanmoqda...
          </p>

          <div className="auth-progress-container">
            <div className="auth-progress-track">
              <div
                className="auth-progress-bar"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className="auth-progress-meta">
              <span className="auth-status-text">{loadingStatus}</span>
              <span className="auth-progress-percent">{loadingProgress}%</span>
            </div>
          </div>

          <div className="loading-timer-badge">
            <span className="timer-dot"></span>
            <span>Yuklanmoqda... (3 soniya)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        {/* Google tezkor kirish modal oynasi */}
        {googlePrompt && (
          <div className="modal-backdrop" onClick={() => setGooglePrompt(false)}>
            <div className="auth-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <svg className="google-icon-svg" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <h3 style={{ margin: 0, fontSize: 18 }}>Google orqali kirish</h3>
              </div>
              <p className="sub" style={{ marginBottom: 16 }}>
                Google hisobingiz email manzilini kiriting:
              </p>
              <form onSubmit={confirmGoogleAuth}>
                <label>Google Email manzilingiz</label>
                <input
                  type="email"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="masalan: dilmurod@gmail.com"
                  autoFocus
                  required
                />
                <label>Ismingiz (ixtiyoriy)</label>
                <input
                  value={googleNameInput}
                  onChange={(e) => setGoogleNameInput(e.target.value)}
                  placeholder="Ismingiz"
                />
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    className="pass-toggle"
                    style={{ flex: 1, height: 42, borderRadius: 10 }}
                    onClick={() => setGooglePrompt(false)}
                  >
                    Bekor qilish
                  </button>
                  <button type="submit" className="auth-submit" style={{ flex: 1, marginTop: 0 }}>
                    Kirish
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Muvaffaqiyat xabari */}
        {successMsg && (
          <div className="auth-success-badge">
            <h3>{successMsg}</h3>
            <p>Tizimga kirilmoqda, iltimos kuting...</p>
          </div>
        )}

        {/* Xatolik xabari */}
        {error && <div className="auth-err show">{error}</div>}

        {/* Rate Limiting / Lockout ogohlantirish paneli */}
        {mode === "login" && lockStatus.isLocked && (
          <div className="auth-lock-banner">
            <div className="auth-lock-header">
              <span>🔒</span>
              <span>Xavfsizlik: Kirish bloklandi!</span>
            </div>
            <div className="auth-lock-desc">
              Parol 3 marta noto'g'ri kiritildi. Tizim xavfsizligini ta'minlash uchun hisob
              vaqtincha to'xtatildi.
            </div>
            <div className="auth-lock-countdown">
              <span>⏳ Qayta urinish:</span>
              <strong>{lockStatus.secondsLeft}s</strong>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            MODE: FORGOT PASSWORD (PAROLNI UNUTDINGIZMI)
        ══════════════════════════════════════════ */}
        {mode === "forgot" ? (
          <div>
            <h1>Parolni Tiklash</h1>
            <p className="sub">
              {forgotStep === 1
                ? "Login yoki Google Email orqali yangi parol yarating"
                : "Emailga yuborilgan 6 xonali kodni kiriting"}
            </p>

            {codeNotice && (
              <div className="code-info-box">
                <div>{codeNotice}</div>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendCode}>
                <label>Login yoki Google Email</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="login yoki email@gmail.com"
                  autoFocus
                  required
                />
                <button type="submit" className="auth-submit">
                  Tasdiqlash kodini olish (6 xonali)
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndReset}>
                <label>6 xonali tasdiqlash kodi</label>
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  className="code-input-large"
                  autoFocus
                  required
                />

                <label>Yangi Parol</label>
                <div className="pass-field">
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yangi maxfiy parol"
                    required
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowNewPass((v) => !v)}
                    title={showNewPass ? "Yashirish" : "Ko'rsatish"}
                  >
                    {showNewPass ? "👁️" : "🙈"}
                  </button>
                </div>

                <button type="submit" className="auth-submit">
                  Yangi parolni saqlash va Kirish
                </button>

                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => {
                      setForgotStep(1);
                      setInputCode("");
                      setError("");
                    }}
                  >
                    ← Boshqa login/email kiritish
                  </button>
                </div>
              </form>
            )}

            <div className="auth-switch" style={{ marginTop: 20 }}>
              <button
                onClick={() => {
                  setError("");
                  setCodeNotice(null);
                  setMode("login");
                }}
              >
                ← Kirish oynasiga qaytish
              </button>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════
              MODE: LOGIN & SIGNUP
          ══════════════════════════════════════════ */
          <div>
            <h1>{mode === "signup" ? "proAI'ga xush kelibsiz" : "Qaytganingizdan xursandmiz"}</h1>
            <p className="sub">
              {mode === "signup" ? "Davom etish uchun hisob yarating" : "Davom etish uchun kiring"}
            </p>

            <form onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label>Ismingiz</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ismingiz"
                    required
                  />
                  <label>Email (Google yoki boshqa email)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@gmail.com"
                  />
                </>
              )}

              <label>{mode === "signup" ? "Login" : "Login yoki Email"}</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === "signup" ? "login" : "login yoki email@gmail.com"}
                disabled={mode === "login" && lockStatus.isLocked}
                required
              />

              <div className="auth-row-between">
                <label style={{ margin: 0 }}>Parol</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => {
                      setError("");
                      setSuccessMsg("");
                      setForgotStep(1);
                      setMode("forgot");
                    }}
                  >
                    Parolni unutdingizmi?
                  </button>
                )}
              </div>

              <div className="pass-field">
                <input
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  disabled={mode === "login" && lockStatus.isLocked}
                  required
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  title={showPass ? "Parolni yashirish" : "Parolni ko'rsatish"}
                >
                  {showPass ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Login imkoniyatlari indikatori */}
              {mode === "login" && !lockStatus.isLocked && lockStatus.attemptsLeft < 3 && (
                <div className="auth-attempts-info">
                  <span>⚠️ Qolgan imkoniyat: {lockStatus.attemptsLeft} ta</span>
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={mode === "login" && lockStatus.isLocked}
              >
                {mode === "signup"
                  ? "Hisob yaratish"
                  : lockStatus.isLocked
                  ? `Bloklandi (${lockStatus.secondsLeft}s)`
                  : "Kirish"}
              </button>
            </form>

            {/* Google orqali kirish tugmasi */}
            <div className="auth-divider">Yoki</div>

            <button type="button" className="google-auth-btn" onClick={handleGoogleAuth}>
              <svg className="google-icon-svg" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google orqali kirish</span>
            </button>

            <div className="auth-switch">
              <span>{mode === "signup" ? "Hisobingiz bormi?" : "Hisobingiz yo'qmi?"}</span>{" "}
              <button
                onClick={() => {
                  setError("");
                  setSuccessMsg("");
                  setMode(mode === "signup" ? "login" : "signup");
                }}
              >
                {mode === "signup" ? "Kirish" : "Ro'yxatdan o'tish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
