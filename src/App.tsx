import {
  Code2,
  Menu,
  Plus,
  Send,
  Settings,
  Square,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import MessageBubble from "./components/MessageBubble";
import SettingsDialog from "./components/SettingsDialog";
import Sidebar from "./components/Sidebar";
import {
  getDirectConfig,
  isStaticDeploy,
  loadDirectConfig,
} from "./lib/directConfig";
import { parseSseBuffer } from "./lib/sse";
import {
  loadConversations,
  makeConversation,
  makeMessage,
  saveConversations,
} from "./lib/storage";
import type {
  ChatMessage,
  Conversation,
  PublicApiConfig,
} from "./types";

const SUGGESTIONS = [
  "生成一个读取 CSV 并统计每列缺失值的 Python 脚本",
  "写一个带重试和超时的 HTTP 请求函数",
  "把 JSON 文件转换为 Markdown 表格",
];

export default function App() {
  const [conversations, setConversations] =
    useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(
    () => loadConversations()[0]?.id ?? null,
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [config, setConfig] = useState<PublicApiConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const openedSettingsRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [activeId, conversations],
  );

  const configured = Boolean(
    config?.baseUrl && config?.model && config?.hasApiKey,
  );

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (isStaticDeploy()) {
      const data = loadDirectConfig();
      setConfig(data);
      if (
        !openedSettingsRef.current &&
        (!data.hasApiKey || !data.baseUrl || !data.model)
      ) {
        openedSettingsRef.current = true;
        setSettingsOpen(true);
      }
      return;
    }

    fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as PublicApiConfig;
        setConfig(data);
        if (
          !openedSettingsRef.current &&
          (!data.hasApiKey || !data.baseUrl || !data.model)
        ) {
          openedSettingsRef.current = true;
          setSettingsOpen(true);
        }
      })
      .catch(() => {
        // The API process may still be starting; the user can open settings later.
      });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [activeConversation?.messages]);

  const updateMessage = (
    conversationId: string,
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              updatedAt: Date.now(),
              messages: conversation.messages.map((message) =>
                message.id === messageId ? updater(message) : message,
              ),
            }
          : conversation,
      ),
    );
  };

  const startNewConversation = () => {
    const conversation = makeConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setInput("");
    setSidebarOpen(false);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }

    if (!configured) {
      setSettingsOpen(true);
      return;
    }

    let conversation = activeConversation;
    if (!conversation) {
      conversation = makeConversation();
      setConversations((current) => [conversation as Conversation, ...current]);
      setActiveId(conversation.id);
    }

    const userMessage = makeMessage("user", text, "done");
    const assistantMessage = makeMessage("assistant", "", "streaming");
    const title =
      conversation.messages.length === 0
        ? text.slice(0, 32)
        : conversation.title;
    const history = [...conversation.messages, userMessage]
      .filter(
        (message) =>
          message.role === "user" ||
          (message.role === "assistant" && message.status === "done"),
      )
      .map(({ role, content }) => ({ role, content }));

    setConversations((current) =>
      current.map((item) =>
        item.id === conversation?.id
          ? {
              ...item,
              title,
              updatedAt: Date.now(),
              messages: [...item.messages, userMessage, assistantMessage],
            }
          : item,
      ),
    );

    setInput("");
    setIsStreaming(true);
    void runGeneration(conversation.id, history, assistantMessage.id);
  };

  const runGeneration = async (
    conversationId: string,
    history: { role: "user" | "assistant"; content: string }[],
    assistantId: string,
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    let buffer = "";

    const append = (content: string) => {
      updateMessage(conversationId, assistantId, (message) => ({
        ...message,
        content: message.content + content,
      }));
    };

    const handleEvent = (event: string, data: unknown) => {
      if (event === "delta" && isRecord(data) && typeof data.content === "string") {
        append(data.content);
      }
      if (event === "error") {
        const message =
          isRecord(data) && typeof data.message === "string"
            ? data.message
            : "生成失败";
        throw new Error(message);
      }
    };

    try {
      const response = isStaticDeploy()
        ? await requestStaticStream(history, controller.signal)
        : await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, messages: history }),
            signal: controller.signal,
          });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `请求失败（${response.status}）`);
      }

      if (!response.body) {
        throw new Error("未收到流式响应");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBuffer(buffer);
        buffer = parsed.rest;
        for (const item of parsed.events) {
          handleEvent(item.event, item.data);
        }
      }

      for (const item of parseSseBuffer(buffer).events) {
        handleEvent(item.event, item.data);
      }

      updateMessage(conversationId, assistantId, (message) => ({
        ...message,
        status: "done",
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateMessage(conversationId, assistantId, (message) => ({
          ...message,
          status: "done",
          content: message.content.trim()
            ? `${message.content}\n\n_已停止生成。_`
            : "_已停止生成。_",
        }));
      } else {
        const message = error instanceof Error ? error.message : "生成失败";
        updateMessage(conversationId, assistantId, (current) => ({
          ...current,
          status: "error",
          content: current.content.trim()
            ? `${current.content}\n\n_生成中断：${message}_`
            : `_生成失败：${message}_`,
        }));
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    // 学生王君宇作品
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="打开对话列表"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Code2 className="h-5 w-5 text-blue-600" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-slate-900">
                Python 代码生成
              </h1>
              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                学生王君宇作品
              </span>
            </div>
            <p className="hidden truncate text-xs text-slate-400 sm:block">
              {activeConversation?.title ?? "通过自定义 API 生成代码"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={startNewConversation}
              title="新建对话"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="API 设置"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"
        >
          <div className="mx-auto w-full max-w-3xl">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <EmptyState onPick={setInput} />
            ) : (
              <div className="space-y-5">
                {activeConversation.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={Math.min(8, Math.max(1, input.split("\n").length))}
                placeholder="描述你需要生成的 Python 功能..."
                className="max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  title="停止生成"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title="发送"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-xs text-slate-400">
              Enter 发送，Shift + Enter 换行
            </p>
          </div>
        </footer>
      </div>

      <SettingsDialog
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSaved={setConfig}
      />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Code2 className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        描述你要生成的 Python 功能
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        可以在设置中接入自己的 OpenAI 兼容 API，然后在下方输入需求开始生成。
      </p>
      <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function requestStaticStream(
  history: { role: "user" | "assistant"; content: string }[],
  signal: AbortSignal,
): Promise<Response> {
  const config = getDirectConfig();
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error("API 尚未配置完整");
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...history,
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      payload?.error?.message ?? `自定义 API 请求失败（${response.status}）`,
    );
  }

  return response;
}
