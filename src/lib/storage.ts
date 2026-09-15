import type { Conversation, MessageAttachment, MessageRole } from "../types";

const STORAGE_KEY = "pycodegen.conversations.v1";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function makeConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId(),
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function makeMessage(
  role: MessageRole,
  content: string,
  status: "pending" | "streaming" | "done" | "error" = "done",
  attachments?: MessageAttachment[],
): Conversation["messages"][number] {
  return {
    id: createId(),
    role,
    content,
    status,
    ...(attachments?.length ? { attachments } : {}),
  };
}
