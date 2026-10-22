import type { Chat, AuthUser } from "../types";

const CHATS_KEY = "proai.chats";
const USERS_KEY = "proai.users";
const SESSION_KEY = "proai.session";
const THEME_KEY = "proai.theme";

export function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChats(chats: Chat[]): void {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats.slice(0, 60)));
  } catch {
    /* ignore */
  }
}

interface StoredUser {
  name: string;
  pass: string;
  email?: string;
}

const LOCK_KEY = "proai.login_lock";

function getUsers(): Record<string, StoredUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function setUsers(users: Record<string, StoredUser>): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

export function signUp(username: string, pass: string, name: string, email?: string): AuthUser | null {
  const users = getUsers();
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email?.trim().toLowerCase();

  if (users[cleanUsername]) return null;
  // Agar email kiritilgan bo'lsa va boshqa foydalanuvchida bo'lsa
  if (cleanEmail) {
    const emailExists = Object.values(users).some((u) => u.email?.toLowerCase() === cleanEmail);
    if (emailExists) return null;
  }

  users[cleanUsername] = {
    name: name.trim() || cleanUsername,
    pass,
    email: cleanEmail || undefined
  };
  setUsers(users);
  localStorage.setItem(SESSION_KEY, cleanUsername);
  return { username: cleanUsername, name: users[cleanUsername].name, email: cleanEmail };
}

export function logIn(loginOrEmail: string, pass: string): AuthUser | null {
  const users = getUsers();
  const query = loginOrEmail.trim().toLowerCase();

  // Avval username orqali tekshirish
  let userKey = Object.keys(users).find((k) => k.toLowerCase() === query);
  
  // Topilmasa email orqali tekshirish
  if (!userKey) {
    userKey = Object.keys(users).find((k) => users[k].email?.toLowerCase() === query);
  }

  if (!userKey) return null;
  const u = users[userKey];
  if (u.pass !== pass) return null;

  localStorage.setItem(SESSION_KEY, userKey);
  clearLoginLock();
  return { username: userKey, name: u.name, email: u.email };
}

export function loginWithGoogle(email: string, name: string): AuthUser {
  const users = getUsers();
  const cleanEmail = email.trim().toLowerCase();
  
  // Avval mavjud hisob bormi tekshiramiz
  let userKey = Object.keys(users).find(
    (k) => users[k].email?.toLowerCase() === cleanEmail || k.toLowerCase() === cleanEmail
  );

  if (!userKey) {
    // Yangi hisob yaratish
    let baseUsername = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase() || "google_user";
    let candidate = baseUsername;
    let counter = 1;
    while (users[candidate]) {
      candidate = `${baseUsername}${counter++}`;
    }
    userKey = candidate;
    users[userKey] = {
      name: name.trim() || baseUsername,
      pass: "google_oauth_session_" + Math.random().toString(36).slice(2),
      email: cleanEmail
    };
    setUsers(users);
  }

  localStorage.setItem(SESSION_KEY, userKey);
  clearLoginLock();
  return { username: userKey, name: users[userKey].name, email: users[userKey].email };
}

export function findUserByLoginOrEmail(query: string): { username: string; name: string; email?: string } | null {
  const users = getUsers();
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // Username bo'yicha
  let userKey = Object.keys(users).find((k) => k.toLowerCase() === q);
  if (!userKey) {
    // Email bo'yicha
    userKey = Object.keys(users).find((k) => users[k].email?.toLowerCase() === q);
  }

  if (!userKey) return null;
  const u = users[userKey];
  return { username: userKey, name: u.name, email: u.email };
}

export function resetUserPassword(loginOrEmail: string, newPass: string): boolean {
  const users = getUsers();
  const q = loginOrEmail.trim().toLowerCase();
  if (!q || !newPass) return false;

  let userKey = Object.keys(users).find((k) => k.toLowerCase() === q);
  if (!userKey) {
    userKey = Object.keys(users).find((k) => users[k].email?.toLowerCase() === q);
  }

  if (!userKey || !users[userKey]) return false;
  users[userKey].pass = newPass;
  setUsers(users);
  return true;
}

// ══════════════════════════════════════════
// LOGIN RATE LIMITING (3 URINISH -> 30s, YANA 3 URINISH -> 60s)
// ══════════════════════════════════════════
interface LockData {
  fails: number;      // joriy bosqichdagi xatolar (0..3)
  lockUntil: number;  // timestamp (ms)
  stage: number;      // 1 (30s) yoki 2 (60s)
}

function getLockData(): LockData {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { fails: 0, lockUntil: 0, stage: 1 };
}

function saveLockData(data: LockData): void {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(data));
  } catch {}
}

export function getLoginLockStatus(): {
  isLocked: boolean;
  secondsLeft: number;
  attemptsLeft: number;
  stage: number;
} {
  const data = getLockData();
  const now = Date.now();

  if (data.lockUntil > now) {
    const secondsLeft = Math.ceil((data.lockUntil - now) / 1000);
    return {
      isLocked: true,
      secondsLeft,
      attemptsLeft: 0,
      stage: data.stage
    };
  }

  // Blok tugagan bo'lsa
  if (data.lockUntil > 0 && data.lockUntil <= now) {
    // Agar 1-bosqich blok tugagan bo'lsa, stage 2 ga o'tadi
    if (data.stage === 1) {
      const nextData: LockData = { fails: 0, lockUntil: 0, stage: 2 };
      saveLockData(nextData);
      return { isLocked: false, secondsLeft: 0, attemptsLeft: 3, stage: 2 };
    } else {
      // 2-bosqich ham tugagan bo'lsa yana tozalab 1-bosqichdan boshlanadi
      const nextData: LockData = { fails: 0, lockUntil: 0, stage: 1 };
      saveLockData(nextData);
      return { isLocked: false, secondsLeft: 0, attemptsLeft: 3, stage: 1 };
    }
  }

  const attemptsLeft = Math.max(0, 3 - data.fails);
  return {
    isLocked: false,
    secondsLeft: 0,
    attemptsLeft,
    stage: data.stage || 1
  };
}

export function recordLoginFailure(): {
  isLocked: boolean;
  secondsLeft: number;
  attemptsLeft: number;
  stage: number;
} {
  const data = getLockData();
  const now = Date.now();

  // Agar allaqachon blokda bo'lsa
  if (data.lockUntil > now) {
    return getLoginLockStatus();
  }

  const newFails = (data.fails || 0) + 1;
  const currentStage = data.stage || 1;

  if (newFails >= 3) {
    // Bloklanish vaqti: 1-bosqichda 30s, 2-bosqichda 60s
    const durationMs = currentStage === 1 ? 30 * 1000 : 60 * 1000;
    const lockUntil = now + durationMs;
    const updated: LockData = {
      fails: 3,
      lockUntil,
      stage: currentStage
    };
    saveLockData(updated);
    return {
      isLocked: true,
      secondsLeft: Math.ceil(durationMs / 1000),
      attemptsLeft: 0,
      stage: currentStage
    };
  }

  const updated: LockData = {
    fails: newFails,
    lockUntil: 0,
    stage: currentStage
  };
  saveLockData(updated);
  return {
    isLocked: false,
    secondsLeft: 0,
    attemptsLeft: 3 - newFails,
    stage: currentStage
  };
}

export function clearLoginLock(): void {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {}
}

export function logOut(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function currentSession(): AuthUser | null {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  const users = getUsers();
  const u = users[username];
  if (!u) return null;
  return { username, name: u.name, email: u.email };
}

export function hasAnyUser(): boolean {
  return Object.keys(getUsers()).length > 0;
}

export function getTheme(): string | null {
  return localStorage.getItem(THEME_KEY);
}

export function setTheme(theme: string): void {
  localStorage.setItem(THEME_KEY, theme);
}

