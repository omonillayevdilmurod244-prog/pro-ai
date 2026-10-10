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
}

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

export function signUp(username: string, pass: string, name: string): AuthUser | null {
  const users = getUsers();
  if (users[username]) return null;
  users[username] = { name: name || username, pass };
  setUsers(users);
  localStorage.setItem(SESSION_KEY, username);
  return { username, name: users[username].name };
}

export function logIn(username: string, pass: string): AuthUser | null {
  const users = getUsers();
  const u = users[username];
  if (!u || u.pass !== pass) return null;
  localStorage.setItem(SESSION_KEY, username);
  return { username, name: u.name };
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
  return { username, name: u.name };
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
