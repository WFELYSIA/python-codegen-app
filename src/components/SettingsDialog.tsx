import { KeyRound, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { isStaticDeploy, saveDirectConfig } from "../lib/directConfig";
import type { ApiConfigForm, PublicApiConfig } from "../types";

interface SettingsDialogProps {
  open: boolean;
  config: PublicApiConfig | null;
  onClose: () => void;
  onSaved: (config: PublicApiConfig) => void;
}

export default function SettingsDialog({
  open,
  config,
  onClose,
  onSaved,
}: SettingsDialogProps) {
  const [form, setForm] = useState<ApiConfigForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !config) {
      return;
    }
    setForm({
      baseUrl: config.baseUrl,
      apiKey: "",
      clearApiKey: false,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      systemPrompt: config.systemPrompt,
    });
    setError("");
  }, [open, config]);

  if (!open) {
    return null;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!form.baseUrl.trim() || !form.model.trim()) {
      setError("API 地址和模型名称为必填项");
      return;
    }
    if (!config?.hasApiKey && !form.apiKey.trim()) {
      setError("请填写 API Key");
      return;
    }

    setSaving(true);
    try {
      if (isStaticDeploy()) {
        onSaved(saveDirectConfig(form));
        onClose();
        return;
      }

      const payload: Record<string, unknown> = {
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        systemPrompt: form.systemPrompt,
        clearApiKey: form.clearApiKey,
      };
      if (form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }

      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as
        | PublicApiConfig
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "保存配置失败",
        );
      }

      onSaved(result as PublicApiConfig);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof ApiConfigForm>(
    key: K,
    value: ApiConfigForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/45"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
      />
      <form
        onSubmit={submit}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-5">
          <KeyRound className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">API 设置</h2>
          <button
            type="button"
            onClick={onClose}
            title="关闭设置"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="API 地址" hint="OpenAI 兼容接口的 base URL">
            <input
              type="url"
              value={form.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder="https://api.example.com/v1"
              className="input-base"
            />
          </Field>

          <Field
            label="API Key"
            hint={
              config?.hasApiKey
                ? "已保存密钥，留空则保持不变"
                : isStaticDeploy()
                  ? "仅保存在当前浏览器，Pages 静态模式下存在暴露风险"
                  : "密钥仅保存在本地服务端"
            }
          >
            <input
              type="password"
              value={form.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
              placeholder={config?.hasApiKey ? "••••••••••••" : "sk-..."}
              className="input-base"
            />
            {config?.hasApiKey ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.clearApiKey}
                  onChange={(event) =>
                    update("clearApiKey", event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                清除已保存的 API Key
              </label>
            ) : null}
          </Field>

          <Field label="模型名称">
            <input
              type="text"
              value={form.model}
              onChange={(event) => update("model", event.target.value)}
              placeholder="例如 gpt-4o-mini"
              className="input-base"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="温度" hint="0 到 2">
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={(event) =>
                  update("temperature", Number(event.target.value))
                }
                className="input-base"
              />
            </Field>
            <Field label="最大 Token">
              <input
                type="number"
                min="1"
                step="1"
                value={form.maxTokens}
                onChange={(event) =>
                  update("maxTokens", Number(event.target.value))
                }
                className="input-base"
              />
            </Field>
          </div>

          <Field label="系统提示词">
            <textarea
              value={form.systemPrompt}
              onChange={(event) => update("systemPrompt", event.target.value)}
              rows={5}
              className="input-base resize-y"
            />
          </Field>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

function emptyForm(): ApiConfigForm {
  return {
    baseUrl: "",
    apiKey: "",
    clearApiKey: false,
    model: "",
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt:
      "你是一个严谨的 Python 代码生成助手。根据用户需求输出可运行的 Python 代码，并附简要说明。",
  };
}
