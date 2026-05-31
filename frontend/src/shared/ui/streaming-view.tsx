import { useMemo } from 'react';
import { ReasoningPanel, splitReasoning } from '@/widgets/chat-view/reasoning-panel';

interface Props {
  content: string;
}

/**
 * Lightweight renderer used WHILE an SSE delta stream is in flight.
 *
 * Why not just use MarkdownContent during stream? Each delta would re-parse
 * the entire buffer through remark-gfm + remark-math + rehype-katex +
 * rehype-highlight and rebuild the React tree from scratch. The result on
 * even short replies is visible jitter: KaTeX boxes mount/unmount, code
 * highlighting re-tokenises, layout reflows. The full renderer is great for
 * a *settled* message but wrong for an in-flight one.
 *
 * Strategy here:
 *  - Split content into completed fenced code blocks + everything else.
 *  - Each closed fence renders as a plain <pre>, no syntax highlight yet.
 *  - The tail (text after the last unmatched ``` or the whole content if no
 *    fence is open) renders as one whitespace-pre-wrap block — markdown
 *    headings/lists/etc. show up as their literal source until the message
 *    is done. That's a deliberate trade: stable layout > fancy mid-stream
 *    rendering. MessageBubble switches to MarkdownContent on assistant_done
 *    and the user briefly sees a fade as the formatted version takes over.
 *  - A blinking caret marks the live cursor position.
 */
export function StreamingView({ content }: Props) {
  const { reasoning, answer } = useMemo(() => splitReasoning(content), [content]);
  const segments = useMemo(() => splitOnFences(answer), [answer]);
  const showCaret = answer.length > 0 || !reasoning;

  return (
    <div>
      {reasoning && <ReasoningPanel content={reasoning} streaming />}
      <div className="relative min-h-[1.5em] whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">
        {segments.map((seg, i) =>
          seg.kind === 'code' ? (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-[13.5px] leading-relaxed"
            >
              <code>{seg.text}</code>
            </pre>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {showCaret && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block w-[2px] animate-pulse bg-[--color-primary] align-text-bottom"
            style={{ height: '1.05em' }}
          />
        )}
      </div>
    </div>
  );
}

type Segment = { kind: 'text' | 'code'; text: string };

function splitOnFences(content: string): Segment[] {
  const out: Segment[] = [];
  const re = /```[\s\S]*?(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      out.push({ kind: 'text', text: content.slice(last, m.index) });
    }
    const raw = m[0];
    // strip opening ```lang? newline
    let stripped = raw.replace(/^```[a-zA-Z0-9+\-_]*\n?/, '');
    // strip closing ``` if present
    if (stripped.endsWith('```')) stripped = stripped.slice(0, -3);
    out.push({ kind: 'code', text: stripped });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    out.push({ kind: 'text', text: content.slice(last) });
  }
  return out;
}
