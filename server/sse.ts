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

export function extractOpenAiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return null;
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

  const record = payload as Record<string, unknown>;
  if (typeof record.content === "string") {
    return record.content;
  }

  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return typeof record.output_text === "string" ? record.output_text : "";
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return "";
  }

  const choice = firstChoice as Record<string, unknown>;
  const delta = choice.delta;
  if (delta && typeof delta === "object") {
    const deltaRecord = delta as Record<string, unknown>;
    const deltaContent =
      deltaRecord.content ?? deltaRecord.reasoning_content ?? deltaRecord.reasoning;
    if (typeof deltaContent === "string") {
      return deltaContent;
    }
  }

  const message = choice.message;
  if (message && typeof message === "object") {
    const messageRecord = message as Record<string, unknown>;
    const messageContent =
      messageRecord.content ?? messageRecord.reasoning_content ?? messageRecord.reasoning;
    if (typeof messageContent === "string") {
      return messageContent;
    }
  }

  if (typeof choice.text === "string") {
    return choice.text;
  }

  return typeof record.output_text === "string" ? record.output_text : "";
}