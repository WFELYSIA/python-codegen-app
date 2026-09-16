import type { ApiConfigForm, PublicApiConfig } from "../types";

const DIRECT_CONFIG_KEY = "pycodegen.directConfig.v1";

interface DirectApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingLevel: number;
  systemPrompt: string;
}

const DEFAULT_SYSTEM_PROMPT =
  "你是一个严谨的 Python 代码生成助手。根据用户需求输出可运行的 Python 代码，并附简要说明。";

export function isStaticDeploy(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith("github.io")
  );
}

export function loadDirectConfig(): PublicApiConfig {
  const fallback: PublicApiConfig = {
    baseUrl: "",
    model: "",
    temperature: 0.2,
    maxTokens: 4096,
    thinkingLevel: 3,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    hasApiKey: false,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(DIRECT_CONFIG_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<DirectApiConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
      temperature: finiteNumber(parsed.temperature, 0.2),
      maxTokens: finiteNumber(parsed.maxTokens, 4096),
      thinkingLevel: clampThinkingLevel(parsed.thinkingLevel),
      systemPrompt:
        typeof parsed.systemPrompt === "string" && parsed.systemPrompt.trim()
          ? parsed.systemPrompt
          : DEFAULT_SYSTEM_PROMPT,
      hasApiKey: Boolean(
        typeof parsed.apiKey === "string" && parsed.apiKey.trim(),
      ),
    };
  } catch {
    return fallback;
  }
}

export function saveDirectConfig(form: ApiConfigForm): PublicApiConfig {
  const current = getDirectConfig();
  const next: DirectApiConfig = {
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    thinkingLevel: current.thinkingLevel,
    systemPrompt: form.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
    apiKey: form.clearApiKey
      ? ""
      : form.apiKey.trim() || current.apiKey,
  };

  window.localStorage.setItem(DIRECT_CONFIG_KEY, JSON.stringify(next));
  return {
    baseUrl: next.baseUrl,
    model: next.model,
    temperature: next.temperature,
    maxTokens: next.maxTokens,
    thinkingLevel: next.thinkingLevel,
    systemPrompt: next.systemPrompt,
    hasApiKey: Boolean(next.apiKey),
  };
}

export function saveDirectThinkingLevel(level: number): PublicApiConfig {
  const current = getDirectConfig();
  const next: DirectApiConfig = {
    ...current,
    thinkingLevel: clampThinkingLevel(level),
  };
  window.localStorage.setItem(DIRECT_CONFIG_KEY, JSON.stringify(next));
  return toPublicConfig(next);
}

export function reasoningEffortForLevel(level: number): "low" | "medium" | "high" {
  const normalized = clampThinkingLevel(level);
  if (normalized <= 2) {
    return "low";
  }
  if (normalized === 3) {
    return "medium";
  }
  return "high";
}

export function getDirectConfig(): DirectApiConfig {
  const fallback: DirectApiConfig = {
    baseUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.2,
    maxTokens: 4096,
    thinkingLevel: 3,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(DIRECT_CONFIG_KEY);
    if (!raw) {
      return fallback;
    }
    return { ...fallback, ...(JSON.parse(raw) as Partial<DirectApiConfig>) };
  } catch {
    return fallback;
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampThinkingLevel(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 3;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function toPublicConfig(config: DirectApiConfig): PublicApiConfig {
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
