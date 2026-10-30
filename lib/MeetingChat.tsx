'use client';

import {
  ChatEntry,
  ChatToggle,
  useChat,
  useMaybeLayoutContext,
  type ChatProps,
} from '@livekit/components-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';
import { CHAT_EMOJIS, CUSTOM_CHAT_EMOJIS, formatChatEmojis } from './chat-emojis';
import Image from 'next/image';

export function MeetingChat({
  messageFormatter,
  messageDecoder,
  messageEncoder,
  channelTopic,
  ...props
}: Omit<ChatProps, 'children'>) {
  const options = useMemo(
    () => ({ messageDecoder, messageEncoder, channelTopic }),
    [messageDecoder, messageEncoder, channelTopic],
  );
  const { chatMessages, send, isSending } = useChat(options);
  const layout = useMaybeLayoutContext();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const lastRead = useRef(0);
  const formatter = useCallback(
    (message: string) => formatChatEmojis(message, messageFormatter),
    [messageFormatter],
  );

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chatMessages]);

  useEffect(() => {
    const latest = chatMessages[chatMessages.length - 1]?.timestamp;
    if (!layout || !latest) return;
    if (layout.widget.state?.showChat) {
      lastRead.current = latest;
      if (layout.widget.state.unreadMessages)
        layout.widget.dispatch?.({ msg: 'unread_msg', count: 0 });
    } else {
      const unread = chatMessages.filter((message) => message.timestamp > lastRead.current).length;
      if (layout.widget.state?.unreadMessages !== unread)
        layout.widget.dispatch?.({ msg: 'unread_msg', count: unread });
    }
  }, [chatMessages, layout]);

  useEffect(() => {
    if (!layout?.widget.state?.showChat) setOpen(false);
  }, [layout?.widget.state?.showChat]);

  useEffect(() => {
    if (!open) return;
    picker.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !picker.current?.contains(event.target as Node) &&
        !emojiButton.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        emojiButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function insertEmoji(value: string) {
    const start = input.current?.selectionStart ?? draft.length;
    const end = input.current?.selectionEnd ?? start;
    setDraft(draft.slice(0, start) + value + draft.slice(end));
    setOpen(false);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(start + value.length, start + value.length);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy.current || isSending) return;
    busy.current = true;
    setError('');
    try {
      await send(draft);
      setDraft('');
      input.current?.focus();
    } catch {
      setError('Could not send your message. Please try again.');
    } finally {
      busy.current = false;
    }
  }

  return (
    <div {...props} className="lk-chat">
      <div className="lk-chat-header">
        Messages
        <ChatToggle className="lk-close-button" aria-label="Close messages" title="Close messages">
          <Icon name="close" />
        </ChatToggle>
      </div>
      <ul
        ref={list}
        className="lk-list lk-chat-messages"
        aria-label="Messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {chatMessages.map((message, index) => {
          const previous = chatMessages[index - 1];
          const hideName = previous?.from?.identity === message.from?.identity && !!previous;
          const hideTimestamp = hideName && message.timestamp - previous.timestamp < 60_000;
          return (
            <ChatEntry
              key={message.id ?? index}
              entry={message}
              hideName={hideName}
              hideTimestamp={hideTimestamp}
              messageFormatter={formatter}
            />
          );
        })}
      </ul>
      <div className="meeting-chat-composer">
        {error && (
          <p className="meeting-chat-error" role="alert">
            {error}
          </p>
        )}
        {open && (
          <div
            ref={picker}
            className="meeting-chat-emoji-picker"
            role="dialog"
            aria-label="Choose an emoji"
          >
            <span>Yoonka</span>
            <div className="meeting-chat-emoji-grid">
              {CUSTOM_CHAT_EMOJIS.map((emoji) => (
                <button
                  className="lk-button"
                  type="button"
                  key={emoji.value}
                  title={emoji.label}
                  aria-label={emoji.label}
                  onClick={() => insertEmoji(emoji.value)}
                >
                  <Image src={emoji.src} alt="" width={28} height={28} unoptimized />
                </button>
              ))}
            </div>
            <span>Emojis</span>
            <div className="meeting-chat-emoji-grid">
              {CHAT_EMOJIS.map((emoji) => (
                <button
                  className="lk-button"
                  type="button"
                  key={emoji.value}
                  title={emoji.label}
                  aria-label={emoji.label}
                  onClick={() => insertEmoji(emoji.value)}
                >
                  {emoji.value}
                </button>
              ))}
            </div>
          </div>
        )}
        <form className="lk-chat-form" onSubmit={submit}>
          <button
            ref={emojiButton}
            className="lk-button meeting-chat-emoji-button"
            type="button"
            aria-label="Add emoji"
            title="Add emoji"
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={isSending}
            onClick={() => setOpen(!open)}
          >
            <Icon name="smile" />
          </button>
          <input
            ref={input}
            className="lk-form-control lk-chat-form-input"
            aria-label="Message"
            placeholder="Write a message…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={isSending}
            onInput={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
          />
          <button
            className="lk-button lk-chat-form-button"
            type="submit"
            aria-label="Send message"
            title="Send message"
            disabled={isSending || !draft.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
