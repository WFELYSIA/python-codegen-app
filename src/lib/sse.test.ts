import { describe, expect, it } from "vitest";
import { parseSseBuffer } from "./sse";

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
});
