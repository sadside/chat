import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatView } from '../chat-view';
import type { Message } from '@/entities/message/types';

// Mock MarkdownContent to avoid async rehype-pretty-code in tests
vi.mock('@/shared/ui/markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string; streaming?: boolean }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

// Stub IntersectionObserver and scrollIntoView
const observeMock = vi.fn();
const disconnectMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation((_cb) => ({
    observe: observeMock,
    disconnect: disconnectMock,
    unobserve: vi.fn(),
  })));
  // jsdom doesn't implement scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const userMsg: Message = {
  id: 'u1', chat_id: 'c1', role: 'user',
  content: 'Hello', aborted: false, created_at: new Date().toISOString(),
};
const assistantMsg: Message = {
  id: 'a1', chat_id: 'c1', role: 'assistant',
  content: 'Hi there', aborted: false, created_at: new Date().toISOString(),
};

describe('ChatView', () => {
  it('shows empty state when no messages', () => {
    render(<ChatView messages={[]} chatId="c1" />);
    expect(screen.getByText('С чего начнём?')).toBeInTheDocument();
  });

  it('renders user and assistant messages', () => {
    render(<ChatView messages={[userMsg, assistantMsg]} chatId="c1" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('shows regenerate button on last assistant message', () => {
    render(<ChatView messages={[userMsg, assistantMsg]} chatId="c1" onRegenerate={vi.fn()} />);
    // The regen button appears on hover — it's in DOM but opacity-0
    expect(screen.getByLabelText('Сгенерировать снова')).toBeInTheDocument();
  });
});
