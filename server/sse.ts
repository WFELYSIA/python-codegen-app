import type { ChatRequestMessage, UpstreamMessage } from "./types.js";

export interface SseMessage {
  event?: string;
  data: string;
}

export interface SseParser {
  push: (text: string) => SseMessage[];
  flush: () => SseMessage[];
}

export function createSseParser(): SseParser {
  let buffer = "";

  const parseBlock = (block: string): SseMessage | null => {
    const message: SseMessage = { data: "" };
    let hasData = false;

    for (const line of block.split("\n")) {
      if (line.startsWith(":")) {
        continue;
      }
      if (line.startsWith("event:")) {
        message.event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        message.data += (hasData ? "\n" : "") + line.slice(5).trimStart();
        hasData = true;
      }
    }

    return hasData ? message : null;
  };

  const consume = (flush: boolean): SseMessage[] => {
    const messages: SseMessage[] = [];
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseBlock(block);
      if (parsed) {
        messages.push(parsed);
      }
      boundary = buffer.indexOf("\n\n");
    }

    if (flush && buffer.trim()) {
      const parsed = parseBlock(buffer);
      if (parsed) {
        messages.push(parsed);
      }
      buffer = "";
    }

    return messages;
  };

  return {
    push(text: string): SseMessage[] {
      buffer += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      return consume(false);
    },
    flush(): SseMessage[] {
      return consume(true);
    },
  };
}

export function buildUpstreamMessages(
  systemPrompt: string,
  messages: ChatRequestMessage[],
): UpstreamMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

export function extractOpenAiDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return "";
  }

  const delta = (firstChoice as Record<string, unknown>).delta;
  if (!delta || typeof delta !== "object") {
    return "";
  }

  const content = (delta as Record<string, unknown>).content;
  return typeof content === "string" ? content : "";
}
