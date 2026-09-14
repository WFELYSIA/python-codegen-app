import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tempDir = mkdtempSync(path.join(tmpdir(), "pycodegen-config-"));
const configPath = path.join(tempDir, "config.json");
process.env.CONFIG_PATH = configPath;

describe("config module", () => {
  const modulePromise = import("../config.js");
  let config: typeof import("../config.js");

  beforeAll(async () => {
    config = await modulePromise;
  });

  it("normalizes a valid base URL and rejects unsupported protocols", () => {
    expect(config.normalizeBaseUrl("  https://example.com/v1/  ")).toBe(
      "https://example.com/v1",
    );
    expect(() => config.normalizeBaseUrl("ftp://example.com")).toThrow(
      "API 地址只支持 http 或 https",
    );
    expect(() => config.normalizeBaseUrl("not a url")).toThrow(
      "API 地址格式不正确",
    );
  });

  it("merges a partial update without dropping a stored API key", () => {
    const current = {
      baseUrl: "https://example.com/v1",
      apiKey: "sk-secret",
      model: "test-model",
      temperature: 0.2,
      maxTokens: 4096,
      systemPrompt: "prompt",
    };

    const updated = config.mergeConfig(current, {
      model: "new-model",
      apiKey: "",
      temperature: 5,
      maxTokens: 999999,
    });

    expect(updated.apiKey).toBe("sk-secret");
    expect(updated.model).toBe("new-model");
    expect(updated.temperature).toBe(2);
    expect(updated.maxTokens).toBe(200000);
  });

  it("clears the API key only when clearApiKey is true", () => {
    const current = {
      baseUrl: "https://example.com/v1",
      apiKey: "sk-secret",
      model: "test-model",
      temperature: 0.2,
      maxTokens: 4096,
      systemPrompt: "prompt",
    };

    expect(config.mergeConfig(current, { clearApiKey: true }).apiKey).toBe("");
  });

  it("loads, saves, and exposes a masked public config", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        baseUrl: "https://example.com/v1",
        apiKey: "sk-hidden",
        model: "test-model",
        temperature: 0.4,
        maxTokens: 2048,
        systemPrompt: "custom prompt",
      }),
      "utf8",
    );

    const loaded = config.loadConfig();
    expect(loaded.apiKey).toBe("sk-hidden");
    expect(loaded.temperature).toBe(0.4);

    await config.saveConfig({ ...loaded, model: "saved-model" });
    const publicConfig = config.toPublicConfig(config.loadConfig());
    expect(publicConfig.model).toBe("saved-model");
    expect(publicConfig.hasApiKey).toBe(true);
    expect("apiKey" in publicConfig).toBe(false);
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });
});
