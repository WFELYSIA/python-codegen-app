import { Code2, FileText, LoaderCircle } from "lucide-react";
import type { ChatMessage } from "../types";
import Markdown from "./Markdown";
import SplitOutput from "./SplitOutput";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-lg bg-blue-600 px-4 py-2.5 text-[15px] leading-7 text-white shadow-sm">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
          {message.attachments?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map((attachment) => (
                <span
                  key={attachment.name}
                  className="flex items-center gap-1 rounded bg-blue-500/70 px-2 py-1 text-xs text-white"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {attachment.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const isError = message.status === "error";
  const isEmpty = !message.content.trim();

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
        <Code2 className="h-4 w-4" />
      </div>
      <div
        className={`min-w-0 flex-1 rounded-lg border bg-white px-4 py-3 shadow-sm ${
          isError ? "border-red-200" : "border-slate-200"
        }`}
      >
        {isEmpty && message.status === "streaming" ? (
          <div className="flex h-7 items-center gap-2 text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span className="text-sm">正在生成</span>
          </div>
        ) : null}

        {!isEmpty ? <SplitOutput content={message.content} /> : null}

        {!isEmpty && message.status === "streaming" ? (
          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-blue-500 align-middle" />
        ) : null}
      </div>
    </div>
  );
}
