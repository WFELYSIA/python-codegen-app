import { describe, expect, it } from "vitest";
import {
  buildUpstreamMessages,
  createSseParser,
  extractOpenAiDelta,
} from "../sse.js";

describe("sse helpers", () => {
  it("buffers partial chunks before emitting complete events", () => {
    const parser = createSseParser();
    expect(parser.push('event: delta\ndata: {"content":"he')).toEqual([]);
    expect(parser.push('llo"}\n\n')).toEqual([
      { event: "delta", data: '{"content":"hello"}' },
    ]);
  });

  it("recognizes the OpenAI done marker", () => {
    const parser = createSseParser();
    expect(parser.push("data: [DONE]\n\n")).toEqual([
      { data: "[DONE]" },
    ]);
  });

  it("extracts only string delta content", () => {
    expect(
      extractOpenAiDelta({
        choices: [{ delta: { content: "print(1)" } }],
      }),
    ).toBe("print(1)");
    expect(extractOpenAiDelta({ choices: [{ delta: {} }] })).toBe("");
    expect(extractOpenAiDelta(null)).toBe("");
  });

  it("prepends the system prompt to chat history", () => {
    expect(
      buildUpstreamMessages("system", [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ]),
    ).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });
});
