import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Composer } from '../composer';

// Composer now renders ModelPicker which fires a /models query. Stub fetch
// so the query resolves to an empty list and the tests can focus on
// composer behaviour without exercising the model picker.
beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('[]', { status: 200 })),
  );
});

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

describe('Composer', () => {
  it('renders textarea and send button', () => {
    render(<Composer onSend={vi.fn()} />, { wrapper });
    expect(screen.getByLabelText('Поле ввода сообщения')).toBeInTheDocument();
    expect(screen.getByLabelText('Отправить сообщение')).toBeInTheDocument();
  });

  it('send button disabled when empty', () => {
    render(<Composer onSend={vi.fn()} />, { wrapper });
    expect(screen.getByLabelText('Отправить сообщение')).toBeDisabled();
  });

  it('calls onSend with trimmed content on button click', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />, { wrapper });
    const textarea = screen.getByLabelText('Поле ввода сообщения');
    await userEvent.type(textarea, '  Hello world  ');
    await userEvent.click(screen.getByLabelText('Отправить сообщение'));
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('calls onSend on Enter, not on Shift+Enter', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />, { wrapper });
    const textarea = screen.getByLabelText('Поле ввода сообщения');
    await userEvent.type(textarea, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    onSend.mockClear();
    await userEvent.type(textarea, 'Line1{Shift>}{Enter}{/Shift}Line2');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows Stop button while streaming', () => {
    render(<Composer onSend={vi.fn()} onStop={vi.fn()} isStreaming />, { wrapper });
    expect(screen.getByLabelText('Остановить генерацию')).toBeInTheDocument();
    expect(screen.queryByLabelText('Отправить сообщение')).not.toBeInTheDocument();
  });

  it('calls onStop when Stop clicked', async () => {
    const onStop = vi.fn();
    render(<Composer onSend={vi.fn()} onStop={onStop} isStreaming />, { wrapper });
    await userEvent.click(screen.getByLabelText('Остановить генерацию'));
    expect(onStop).toHaveBeenCalled();
  });

  it('clears textarea after send', async () => {
    render(<Composer onSend={vi.fn()} />, { wrapper });
    const textarea = screen.getByLabelText('Поле ввода сообщения');
    await userEvent.type(textarea, 'Hello');
    await userEvent.click(screen.getByLabelText('Отправить сообщение'));
    expect(textarea).toHaveValue('');
  });
});
