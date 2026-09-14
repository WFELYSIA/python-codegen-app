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
