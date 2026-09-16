export interface ClientSseEvent {
  event: string;
  data: unknown;
}

export interface ParsedSse {
  events: ClientSseEvent[];
  rest: string;
}

export function parseSseBuffer(buffer: string): ParsedSse {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const events: ClientSseEvent[] = [];
  let rest = normalized;
  let boundary = rest.indexOf("\n\n");

  while (boundary !== -1) {
    const block = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    const parsed = parseBlock(block);
    if (parsed) {
      events.push(parsed);
    }
    boundary = rest.indexOf("\n\n");
  }

  return { events, rest };
}

function parseBlock(block: string): ClientSseEvent | null {
  let event = "message";
  let dataText = "";
  let hasData = false;

  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataText += (hasData ? "\n" : "") + line.slice(5).trimStart();
      hasData = true;
    }
  }

  if (!hasData) {
    return null;
  }

  let data: unknown = dataText;
  try {
    data = JSON.parse(dataText);
  } catch {
    // Keep the raw text when the event is not JSON.
  }

  return { event, data };
}
export function extractOpenAiText(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
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