import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-2 overflow-hidden rounded-2xl bg-muted/60">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="tc-scroll overflow-x-auto px-3 py-3 pr-10 text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Renders assistant markdown: lists, tables, links, inline + block code. */
export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="text-[15px] leading-relaxed [&_a]:underline [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">{children}</a>
          ),
          code: ({ className, children }) => {
            const raw = String(children ?? "").replace(/\n$/, "");
            if (!className && !raw.includes("\n")) {
              return <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">{raw}</code>;
            }
            return <CodeBlock code={raw} />;
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="tc-scroll my-2 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-border px-2.5 py-1.5 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/60 px-2.5 py-1.5">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
