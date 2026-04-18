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
 * Normalise LaTeX delimiters that local models often emit in the wrong form.
 *
 * remark-math only recognises `$x$` (inline) and `$$x$$` (block). Many models
 * produce `\(x\)`, `\[x\]`, and even bare `[ x ]` / `( x )` around LaTeX —
 * we fix them up before handing the text to markdown parsing.
 */
function normaliseLatex(src: string): string {
  let out = src;

  // \[ ... \]  →  $$ ... $$   (block)
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n$$${body}$$\n`);

  // \( ... \)  →  $ ... $     (inline)
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);

  // Bare block formula:  `[ \something ... ]` on its own line (or preceded by
  // a newline) — matches the "[ Z_n = \frac{...} ]" pattern local models emit.
  out = out.replace(
    /(^|\n)\s*\[\s*((?:\\[a-zA-Z]+|[^\]\n]){1,})\s*\]\s*(?=\n|$)/g,
    (_m, lead, body) => `${lead}\n$$${body.trim()}$$\n`,
  );

  // Bare inline formula:  `( \something ... )` — only when body contains a
  // backslash command or `_` / `^` subscripts so we don't eat regular
  // parentheses in prose.
  out = out.replace(
    /\(\s*((?:\\[a-zA-Z]+[^()]*|[A-Za-z0-9]+_[A-Za-z0-9]+|[A-Za-z0-9]+\^[A-Za-z0-9]+)[^()]*)\s*\)/g,
    (_m, body) => `$${body.trim()}$`,
  );

  return out;
}

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
  const normalised = React.useMemo(() => normaliseLatex(content), [content]);

  return (
    <div
      className={cn(
        // Explicit colour + typography utilities — we deliberately don't use
        // Tailwind's `prose`, because it overrides text colour via its own
        // `--tw-prose-*` tokens that are independent of our OKLCH theme and
        // rendered near-invisible on the light beige background.
        'text-[15px] leading-relaxed text-[--color-foreground]',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        // Paragraphs + inline runs
        '[&_p]:my-3 [&_p]:leading-7 [&_p]:text-[--color-foreground]',
        // Headings
        '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-[--color-foreground]',
        '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[--color-foreground]',
        '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-[--color-foreground]',
        '[&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-[--color-foreground]',
        // Lists
        '[&_ul]:my-3 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:marker:text-[--color-muted-foreground]',
        '[&_ol]:my-3 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:marker:text-[--color-muted-foreground]',
        '[&_li]:my-1 [&_li>p]:my-0',
        // Emphasis
        '[&_strong]:font-semibold [&_strong]:text-[--color-foreground]',
        '[&_em]:italic',
        // Inline code
        '[&_code]:rounded [&_code]:bg-[--color-muted] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.88em] [&_code]:font-medium [&_code]:text-[--color-foreground]',
        // Fenced code — PreBlock renders its own container, so reset defaults
        '[&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:my-0',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:text-sm',
        // Links
        '[&_a]:text-[--color-primary] [&_a]:no-underline hover:[&_a]:underline',
        // Blockquote
        '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-l-[--color-primary]',
        '[&_blockquote]:bg-[--color-muted]/40 [&_blockquote]:rounded-r-md',
        '[&_blockquote]:px-4 [&_blockquote]:py-1 [&_blockquote]:text-[--color-muted-foreground]',
        // HR
        '[&_hr]:my-6 [&_hr]:border-[--color-border]',
        // Tables
        '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
        '[&_th]:border [&_th]:border-[--color-border] [&_th]:bg-[--color-muted] [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold',
        '[&_td]:border [&_td]:border-[--color-border] [&_td]:px-3 [&_td]:py-1.5',
        // KaTeX display blocks — a touch of vertical breathing room
        '[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto',
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
        {normalised}
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
