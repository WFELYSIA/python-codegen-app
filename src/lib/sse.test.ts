import { describe, expect, it } from "vitest";
import {
  extractOpenAiError,
  extractOpenAiText,
  parseSseBuffer,
} from "./sse";

describe("client SSE parser", () => {
  it("parses JSON event data and preserves incomplete trailing chunks", () => {
    const result = parseSseBuffer(
      'event: delta\ndata: {"content":"hi"}\n\nevent: delta\ndata: {"content":" the',
    );

    expect(result.events).toEqual([
      { event: "delta", data: { content: "hi" } },
    ]);
    expect(result.rest).toBe(
      'event: delta\ndata: {"content":" the',
    );
  });

  it("keeps raw text when data is not JSON", () => {
    const result = parseSseBuffer("data: [DONE]\n\n");
    expect(result.events).toEqual([{ event: "message", data: "[DONE]" }]);
  });

  it("extracts common OpenAI-compatible response shapes", () => {
    expect(extractOpenAiText({ choices: [{ message: { content: "hi" } }] })).toBe(
      "hi",
    );
    expect(extractOpenAiText({ output_text: "plain" })).toBe("plain");
    expect(extractOpenAiError({ error: { message: "bad" } })).toBe("bad");
  });
});
