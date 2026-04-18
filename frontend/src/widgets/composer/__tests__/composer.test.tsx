import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '../composer';

describe('Composer', () => {
  it('renders textarea and send button', () => {
    render(<Composer onSend={vi.fn()} />);
    expect(screen.getByLabelText('Message input')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
  });

  it('send button disabled when empty', () => {
    render(<Composer onSend={vi.fn()} />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('calls onSend with trimmed content on button click', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const textarea = screen.getByLabelText('Message input');
    await userEvent.type(textarea, '  Hello world  ');
    await userEvent.click(screen.getByLabelText('Send message'));
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('calls onSend on Enter, not on Shift+Enter', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const textarea = screen.getByLabelText('Message input');
    await userEvent.type(textarea, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    onSend.mockClear();
    await userEvent.type(textarea, 'Line1{Shift>}{Enter}{/Shift}Line2');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows Stop button while streaming', () => {
    render(<Composer onSend={vi.fn()} onStop={vi.fn()} isStreaming />);
    expect(screen.getByLabelText('Stop generation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
  });

  it('calls onStop when Stop clicked', async () => {
    const onStop = vi.fn();
    render(<Composer onSend={vi.fn()} onStop={onStop} isStreaming />);
    await userEvent.click(screen.getByLabelText('Stop generation'));
    expect(onStop).toHaveBeenCalled();
  });

  it('clears textarea after send', async () => {
    render(<Composer onSend={vi.fn()} />);
    const textarea = screen.getByLabelText('Message input');
    await userEvent.type(textarea, 'Hello');
    await userEvent.click(screen.getByLabelText('Send message'));
    expect(textarea).toHaveValue('');
  });
});
