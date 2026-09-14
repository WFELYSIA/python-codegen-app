import { Check, Copy, Download } from "lucide-react";
import {
  isValidElement,
  type ReactNode,
  useState,
} from "react";

interface CodeBlockProps {
  children: ReactNode;
}

interface CodeChildProps {
  className?: string;
  children?: ReactNode;
}

export default function CodeBlock({ children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const code = extractText(children);
  const language = extractLanguage(children) || "text";
  const isPython = language === "python" || language === "py";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/x-python;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "generated.py";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="group my-3 overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a]">
      <div className="flex h-10 items-center justify-between border-b border-slate-700/70 px-3">
        <span className="font-mono text-xs text-slate-400">{language}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            title={copied ? "已复制" : "复制代码"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {isPython ? (
            <button
              type="button"
              onClick={download}
              title="下载 Python 文件"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-6">
        <code className={`hljs language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (isValidElement<CodeChildProps>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function extractLanguage(node: ReactNode): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const language = extractLanguage(child);
      if (language) {
        return language;
      }
    }
    return null;
  }

  if (!isValidElement<CodeChildProps>(node)) {
    return null;
  }

  const className = node.props.className ?? "";
  const match = className.match(/language-([\w-]+)/);
  return match ? match[1] : null;
}
