import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

interface MarkdownProps {
  content: string;
}

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-rose-700"
        {...props}
      >
        {children}
      </code>
    );
  },
  a: ({ children, ...props }) => (
    <a
      className="text-blue-600 underline decoration-blue-300 underline-offset-2"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

export default function Markdown({ content }: MarkdownProps) {
  return (
    <div className="markdown-body min-w-0 text-[15px] leading-7 text-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
