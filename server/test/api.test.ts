import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const tempDir = mkdtempSync(path.join(tmpdir(), "pycodegen-api-"));
process.env.CONFIG_PATH = path.join(tempDir, "config.json");

describe("api routes", () => {
  let app: ReturnType<typeof import("../app.js").createApp>;
  let apiServer: Server;
  let upstreamServer: Server;
  let apiUrl = "";
  let upstreamUrl = "";
  let receivedAuthorization = "";

  beforeAll(async () => {
    upstreamServer = createServer((req, res) => {
      if (req.url === "/v1/chat/completions") {
        receivedAuthorization = req.headers.authorization ?? "";
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        res.write(
          'data: {"choices":[{"delta":{"content":"print("}}]}\n\n',
        );
        res.write(
          'data: {"choices":[{"delta":{"content":"\'hi\'"}}]}\n\n',
        );
        res.end("data: [DONE]\n\n");
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => {
      upstreamServer.listen(0, "127.0.0.1", resolve);
    });
    const address = upstreamServer.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to start upstream server");
    }
    upstreamUrl = `http://127.0.0.1:${address.port}/v1`;

    vi.resetModules();
    app = (await import("../app.js")).createApp();
    apiServer = createServer(app);
    await new Promise<void>((resolve) => {
      apiServer.listen(0, "127.0.0.1", resolve);
    });
    const apiAddress = apiServer.address();
    if (!apiAddress || typeof apiAddress === "string") {
      throw new Error("failed to start app server");
    }
    apiUrl = `http://127.0.0.1:${apiAddress.port}`;
  });

  beforeEach(async () => {
    await request(apiServer).put("/api/config").send({
      baseUrl: upstreamUrl,
      apiKey: "sk-test-secret",
      model: "test-model",
      temperature: 0.2,
      maxTokens: 1024,
      systemPrompt: "test prompt",
    });
    receivedAuthorization = "";
  });

  it("returns health and a masked config", async () => {
    const health = await request(apiServer).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ ok: true });

    const config = await request(apiServer).get("/api/config");
    expect(config.status).toBe(200);
    expect(config.body.hasApiKey).toBe(true);
    expect(config.body.baseUrl).toBe(upstreamUrl);
    expect(config.body).not.toHaveProperty("apiKey");
  });

  it("streams an upstream OpenAI-compatible response", async () => {
    const response = await fetch(`${apiUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: "test-conversation",
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('event: meta');
    expect(body).toContain('"content":"print("');
    expect(body).toContain('"content":"\'hi\'"');
    expect(body).toContain("event: done");
    expect(receivedAuthorization).toBe("Bearer sk-test-secret");
  });

  it("rejects a missing stream configuration", async () => {
    rmSync(process.env.CONFIG_PATH ?? "", { force: true });
    vi.resetModules();
    const cleanApp = (await import("../app.js")).createApp();
    const cleanServer = createServer(cleanApp);
    await new Promise<void>((resolve) => {
      cleanServer.listen(0, "127.0.0.1", resolve);
    });
    const cleanAddress = cleanServer.address();
    const cleanUrl =
      typeof cleanAddress === "object" && cleanAddress
        ? `http://127.0.0.1:${cleanAddress.port}`
        : "";

    const response = await fetch(`${cleanUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("尚未配置完整");
    cleanServer.close();
  });

  afterAll(() => {
    apiServer.close();
    upstreamServer.close();
    rmSync(tempDir, { recursive: true, force: true });
  });
});
