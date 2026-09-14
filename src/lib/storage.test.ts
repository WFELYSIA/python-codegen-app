import { describe, expect, it, vi } from "vitest";
import {
  loadConversations,
  makeConversation,
  makeMessage,
  saveConversations,
} from "./storage";

describe("conversation storage", () => {
  it("creates unique messages and conversations", () => {
    const conversation = makeConversation();
    const user = makeMessage("user", "hello");
    expect(conversation.id).toBeTruthy();
    expect(user.id).toBeTruthy();
    expect(user.role).toBe("user");
  });

  it("persists and restores conversations through localStorage", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    const conversation = makeConversation();
    conversation.messages = [makeMessage("user", "write python")];
    saveConversations([conversation]);

    const restored = loadConversations();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(conversation.id);
    expect(restored[0].messages[0].content).toBe("write python");
  });
});
