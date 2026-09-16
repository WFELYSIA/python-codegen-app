import hljs from "highlight.js/lib/common";
import { Check, Copy, Download, FileCode2, MessagesSquare } from "lucide-react";
import { useRef, useState } from "react";
import Markdown from "./Markdown";

interface CodeSection {
  language: string;
  code: string;
}

interface SplitOutputProps {
  content: string;
}

export default function SplitOutput({ content }: SplitOutputProps) {
  const sections = extractSections(content);
  if (sections.codeBlocks.length === 0) {
    return <Markdown content={content} />;
  }

  const codeRef = useRef<HTMLDivElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const syncScroll = (
    source: React.RefObject<HTMLDivElement | null>,
    target: React.RefObject<HTMLDivElement | null>,
  ) => {
    if (syncingRef.current || !source.current || !target.current) {
      return;
    }
    const sourceMax = source.current.scrollHeight - source.current.clientHeight;
    const targetMax = target.current.scrollHeight - target.current.clientHeight;
    if (sourceMax <= 0 || targetMax <= 0) {
      return;
    }
    syncingRef.current = true;
    const ratio = source.current.scrollTop / sourceMax;
    target.current.scrollTop = ratio * targetMax;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex h-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a] md:h-[520px] xl:h-[600px]">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-700/70 px-3 text-slate-200">
          <FileCode2 className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium">纯代码</span>
          <span className="text-xs text-slate-500">
            {sections.codeBlocks.length} 段
          </span>
        </div>
        <div
          ref={codeRef}
          onScroll={() => syncScroll(codeRef, explanationRef)}
          className="min-h-0 flex-1 overflow-y-auto p-3"
        >
          <div className="space-y-4">
            {sections.codeBlocks.map((section, index) => (
              <CodeSectionBlock key={`${index}-${section.language}`} section={section} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white md:h-[520px] xl:h-[600px]">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 px-3 text-slate-700">
          <MessagesSquare className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">中文解释</span>
        </div>
        <div
          ref={explanationRef}
          onScroll={() => syncScroll(explanationRef, codeRef)}
          className="min-h-0 flex-1 overflow-y-auto p-3"
        >
          {sections.prose.trim() ? (
            <Markdown content={sections.prose} />
          ) : (
            <p className="text-sm text-slate-400">暂无解释内容</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeSectionBlock({ section }: { section: CodeSection }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(section.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([section.code], {
      type: "text/x-python;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "generated.py";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const highlighted = highlightCode(section.code, section.language);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/80">
      <div className="flex h-9 items-center justify-between border-b border-slate-700/80 bg-slate-900 px-3">
        <span className="font-mono text-xs text-slate-400">
          {section.language || "text"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            title={copied ? "已复制" : "复制代码"}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={download}
            title="下载 Python 文件"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-6 text-slate-100">
        <code
          className={`hljs language-${section.language || "text"}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

function extractSections(content: string): {
  codeBlocks: CodeSection[];
  prose: string;
} {
  const codeBlocks: CodeSection[] = [];
  const fencePattern = /```[^\r\n]*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let prose = "";

  while ((match = fencePattern.exec(content)) !== null) {
    prose += content.slice(lastIndex, match.index);
    const header = match[0].match(/```([\w-]*)/);
    codeBlocks.push({
      language: header?.[1] || "text",
      code: match[1].replace(/\n$/, ""),
    });
    lastIndex = match.index + match[0].length;
  }
  prose += content.slice(lastIndex);

  return { codeBlocks, prose: prose.trim() };
}

function highlightCode(code: string, language: string): string {
  try {
    if (language !== "text" && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}