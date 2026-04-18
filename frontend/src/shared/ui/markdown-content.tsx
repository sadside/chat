import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';

interface MarkdownContentProps {
  content: string;
  /** Append a blinking cursor at the end (for in-flight streaming) */
  streaming?: boolean;
}

function CodeBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string | undefined;
}) {
  const code = String(children).trimEnd();
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="relative group">
      <button
        onClick={() => copy(code)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                   rounded p-1 bg-muted hover:bg-muted/80"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className={className}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content, streaming }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypePrettyCode,
            {
              theme: {
                dark: 'github-dark',
                light: 'github-light',
              },
              keepBackground: true,
            },
          ],
        ]}
        components={{
          // Override pre to inject the copy button wrapper
          pre: ({ children, ...props }) => (
            <CodeBlock {...props}>{children}</CodeBlock>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span
          className="inline-block w-[0.5ch] h-[1.1em] bg-current align-text-bottom ml-px
                     animate-[blink_1s_step-end_infinite]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
