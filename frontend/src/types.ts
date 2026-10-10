export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
  image?: string;
}

export interface Chat {
  id: string;
  title: string;
  msgs: Message[];
}

export interface AuthUser {
  username: string;
  name: string;
}
