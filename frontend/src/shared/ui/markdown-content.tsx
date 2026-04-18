import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';
import { cn } from '@/shared/lib/utils';

interface MarkdownContentProps {
  content: string;
  /** Append a blinking cursor at the end (for in-flight streaming) */
  streaming?: boolean;
}

/**
 * A pretty, dark, rounded code block with a copy button.
 *
 * rehype-highlight wraps code in `<pre><code class="hljs language-xxx">...</code></pre>`.
 * We replace `<pre>` entirely so we control padding, rounding, scrollbar,
 * and the hover copy button. Syntax tokens are coloured via `github-dark.css`.
 */
function PreBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string | undefined;
}) {
  const { codeText, langLabel } = React.useMemo(() => {
    const codeChild = React.Children.toArray(children).find(
      (c): c is React.ReactElement<{ children?: React.ReactNode; className?: string }> =>
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
    const text = extract(codeChild?.props.children).trimEnd();
    const langClass = codeChild?.props.className ?? '';
    const match = /language-([\w+-]+)/.exec(langClass);
    return {
      codeText: text,
      langLabel: match?.[1] ?? '',
    };
  }, [children]);

  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-[--color-border] bg-[oklch(0.16_0.015_264)]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-xs text-white/60">
        <span className="font-mono uppercase tracking-wide">{langLabel || 'code'}</span>
        <button
          onClick={() => copy(codeText)}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Скопировать код"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
      <pre className={cn('overflow-x-auto p-4 text-sm leading-relaxed', className)}>
        {children}
      </pre>
    </div>
  );
}

export function MarkdownContent({ content, streaming }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none',
        // Typography polish — keep line-height comfortable, tame base size,
        // tighter spacing between block elements (less flab than prose default).
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        'prose-p:my-3 prose-p:leading-7',
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:mt-6 prose-h1:mb-3 prose-h1:text-2xl',
        'prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-xl',
        'prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-lg',
        'prose-ul:my-3 prose-ol:my-3 prose-li:my-1',
        'prose-blockquote:border-l-[--color-primary] prose-blockquote:border-l-2',
        'prose-blockquote:bg-[--color-muted]/40 prose-blockquote:rounded-r-md',
        'prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:not-italic',
        'prose-strong:text-foreground',
        'prose-code:before:hidden prose-code:after:hidden',
        'prose-code:rounded prose-code:bg-[--color-muted] prose-code:px-1.5 prose-code:py-0.5',
        'prose-code:text-[0.9em] prose-code:font-medium prose-code:text-foreground',
        'prose-pre:!bg-transparent prose-pre:!p-0 prose-pre:!my-0',
        'prose-a:text-[--color-primary] prose-a:no-underline hover:prose-a:underline',
        'prose-hr:my-6 prose-hr:border-[--color-border]',
        'prose-table:my-4',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
          [rehypeKatex, { strict: false, trust: false, output: 'html' }],
        ]}
        components={{
          pre: ({ children, ...props }) => <PreBlock {...props}>{children}</PreBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span
          className="ml-px inline-block h-[1.1em] w-[0.5ch] bg-current align-text-bottom animate-[blink_1s_step-end_infinite]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
