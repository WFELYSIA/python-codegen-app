import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ApiConfig,
  PublicApiConfig,
  UpdateConfigRequest,
} from "./types.js";

export class ConfigError extends Error {}

const DEFAULT_SYSTEM_PROMPT =
  "你是一个严谨的 Python 代码生成助手。根据用户需求输出可运行的 Python 代码，并附简要说明。";

export const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.2,
  maxTokens: 4096,
  thinkingLevel: 3,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

export const CONFIG_PATH =
  process.env.CONFIG_PATH ?? path.resolve(process.cwd(), "server", "data", "config.json");

export function normalizeBaseUrl(input: string): string {
  const value = input.trim().replace(/\/+$/, "");
  if (!value) {
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigError("API 地址格式不正确");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError("API 地址只支持 http 或 https");
  }

  return value;
}

export function loadConfig(): ApiConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    if (!raw) {
      return { ...DEFAULT_CONFIG };
    }

    const parsed = JSON.parse(raw) as Partial<ApiConfig>;
    return {
      baseUrl: normalizeBaseUrl(
        typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      ),
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
      temperature: finiteNumber(parsed.temperature, DEFAULT_CONFIG.temperature),
      maxTokens: finiteNumber(parsed.maxTokens, DEFAULT_CONFIG.maxTokens),
      thinkingLevel: clampInteger(
        finiteNumber(parsed.thinkingLevel, DEFAULT_CONFIG.thinkingLevel),
        1,
        5,
      ),
      systemPrompt:
        typeof parsed.systemPrompt === "string" && parsed.systemPrompt.trim()
          ? parsed.systemPrompt
          : DEFAULT_CONFIG.systemPrompt,
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: ApiConfig): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export function toPublicConfig(config: ApiConfig): PublicApiConfig {
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    thinkingLevel: config.thinkingLevel,
    systemPrompt: config.systemPrompt,
    hasApiKey: Boolean(config.apiKey),
  };
}

export function mergeConfig(
  current: ApiConfig,
  patch: UpdateConfigRequest,
): ApiConfig {
  const next: ApiConfig = { ...current };

  if (typeof patch.baseUrl === "string") {
    next.baseUrl = normalizeBaseUrl(patch.baseUrl);
  }
  if (typeof patch.model === "string") {
    next.model = patch.model.trim();
  }
  if (patch.temperature !== undefined) {
    next.temperature = clampNumber(patch.temperature, 0, 2);
  }
  if (patch.maxTokens !== undefined) {
    next.maxTokens = clampInteger(patch.maxTokens, 1, 200000);
  }
  if (patch.thinkingLevel !== undefined) {
    next.thinkingLevel = clampInteger(patch.thinkingLevel, 1, 5);
  }
  if (typeof patch.systemPrompt === "string" && patch.systemPrompt.trim()) {
    next.systemPrompt = patch.systemPrompt.trim();
  }
  if (patch.clearApiKey) {
    next.apiKey = "";
  } else if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
    next.apiKey = patch.apiKey.trim();
  }

  return next;
}

export function toReasoningEffort(level: number): "low" | "medium" | "high" {
  const normalized = clampInteger(level, 1, 5);
  if (normalized <= 2) {
    return "low";
  }
  if (normalized === 3) {
    return "medium";
  }
  return "high";
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
