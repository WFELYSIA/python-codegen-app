import { existsSync } from "node:fs";
import path from "node:path";
import express, {
  type NextFunction,
  type Request,
  type Response as ExpressResponse,
} from "express";
import {
  ConfigError,
  loadConfig,
  mergeConfig,
  saveConfig,
  toPublicConfig,
  toReasoningEffort,
} from "./config.js";
import {
  buildUpstreamMessages,
  createSseParser,
  extractOpenAiDelta,
  extractOpenAiError,
} from "./sse.js";
import type { ChatRequestMessage, ChatStreamRequest } from "./types.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/config", (_req, res, next) => {
    try {
      res.json(toPublicConfig(loadConfig()));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/config", async (req, res, next) => {
    try {
      if (!isObject(req.body)) {
        return res.status(400).json({ error: "请求体格式不正确" });
      }

      const current = loadConfig();
      const nextConfig = mergeConfig(current, req.body);
      await saveConfig(nextConfig);
      res.json(toPublicConfig(nextConfig));
    } catch (error) {
      if (error instanceof ConfigError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  app.post("/api/chat/stream", async (req, res, next) => {
    try {
      const parsedMessages = parseChatMessages(req.body);
      if (!parsedMessages) {
        return res.status(400).json({ error: "缺少有效的对话消息" });
      }

      const config = loadConfig();
      const thinkingLevel = parseThinkingLevel(req.body) ?? config.thinkingLevel;
      if (!config.baseUrl || !config.apiKey || !config.model) {
        return res.status(400).json({ error: "API 尚未配置完整" });
      }

      const controller = new AbortController();
      let upstreamResponse: globalThis.Response;
      try {
        upstreamResponse = (await fetch(
          `${config.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model,
              messages: buildUpstreamMessages(
                config.systemPrompt,
                parsedMessages,
              ),
              temperature: config.temperature,
              max_tokens: config.maxTokens,
              reasoning_effort: toReasoningEffort(thinkingLevel),
              stream: true,
            }),
            signal: controller.signal,
          },
        )) as unknown as globalThis.Response;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        return res.status(502).json({ error: "无法连接自定义 API" });
      }

      if (!upstreamResponse.ok) {
        return res
          .status(502)
          .json({ error: `自定义 API 返回错误（${upstreamResponse.status}）` });
      }

      if (!upstreamResponse.body) {
        return res.status(502).json({ error: "自定义 API 未返回流式响应" });
      }

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      sendSse(res, "meta", { model: config.model, thinkingLevel });

      let finished = false;
      const finish = () => {
        if (!finished) {
          finished = true;
          res.end();
        }
      };

      res.on("close", () => {
        if (!finished) {
          controller.abort();
          finished = true;
        }
      });

      const parser = createSseParser();
      const decoder = new TextDecoder();

      try {
        for await (const chunk of upstreamResponse.body as unknown as AsyncIterable<
          Uint8Array
        >) {
          const text = decoder.decode(chunk, { stream: true });
          for (const message of parser.push(text)) {
            if (message.data.trim() === "[DONE]") {
              sendSse(res, "done", {});
              finish();
              return;
            }
            const content = parseDelta(message.data);
            if (content) {
              sendSse(res, "delta", { content });
            }
          }
        }

        for (const message of parser.flush()) {
          if (message.data.trim() === "[DONE]") {
            continue;
          }
          const content = parseDelta(message.data);
          if (content) {
            sendSse(res, "delta", { content });
          }
        }

        sendSse(res, "done", {});
        finish();
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        if (!finished) {
          sendSse(res, "error", { message: "流式响应处理失败" });
          finish();
        }
      }
    } catch (error) {
      next(error);
    }
  });

  const distDir = path.resolve(process.cwd(), "dist");
  if (existsSync(path.join(distDir, "index.html"))) {
    app.use(express.static(distDir));
    app.use((req: Request, res: ExpressResponse, next: NextFunction) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(distDir, "index.html"));
        return;
      }
      next();
    });
  }

  app.use(
    (
      error: unknown,
      _req: Request,
      res: ExpressResponse,
      _next: NextFunction,
    ) => {
      console.error(error);
      if (res.headersSent) {
        return;
      }
      res.status(500).json({ error: "服务器内部错误" });
    },
  );

  return app;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseChatMessages(
  body: unknown,
): ChatRequestMessage[] | null {
  if (!isObject(body) || !Array.isArray(body.messages)) {
    return null;
  }

  const request = body as unknown as ChatStreamRequest;
  const messages: ChatRequestMessage[] = [];
  for (const message of request.messages) {
    if (
      !message ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      return null;
    }
    messages.push({ role: message.role, content: message.content });
  }

  return messages.length > 0 ? messages : null;
}

function parseThinkingLevel(body: unknown): number | undefined {
  if (!isObject(body) || typeof body.thinkingLevel !== "number") {
    return undefined;
  }
  return Math.min(5, Math.max(1, Math.round(body.thinkingLevel)));
}

function parseDelta(data: string): string {
  try {
    return extractOpenAiDelta(JSON.parse(data));
  } catch {
    return "";
  }
}

function sendSse(res: ExpressResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
