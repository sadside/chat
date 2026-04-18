import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';

interface MarkdownContentProps {
  content: string;
  /** Append a blinking cursor at the end (for in-flight streaming) */
  streaming?: boolean;
}

function PreBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string | undefined;
}) {
  // Extract the raw code text from <code> child for copy-to-clipboard.
  const codeText = React.useMemo(() => {
    const child = React.Children.toArray(children).find(
      (c): c is React.ReactElement<{ children?: React.ReactNode }> =>
        React.isValidElement(c) && (c as React.ReactElement).type === 'code',
    );
    const extract = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extract).join('');
      if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
        return extract(node.props.children);
      }
      return '';
    };
    return extract(child?.props.children).trimEnd();
  }, [children]);

  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="relative group">
      <button
        onClick={() => copy(codeText)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                   rounded p-1.5 bg-[--color-muted] hover:bg-[--color-muted]/80
                   focus:outline-none focus-visible:opacity-100"
        aria-label="Скопировать код"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className={className}>{children}</pre>
    </div>
  );
}

export function MarkdownContent({ content, streaming }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children, ...props }) => <PreBlock {...props}>{children}</PreBlock>,
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
