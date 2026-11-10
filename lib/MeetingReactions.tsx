'use client';

import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState, Participant, RoomEvent } from 'livekit-client';
import { RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { useConferenceControlBar } from './useConferenceControlBar';
import Image from 'next/image';
import { EmojiStore, useEmojiStore } from './EmojiStore';
import {
  decodeReaction,
  encodeReaction,
  STANDARD_REACTIONS,
  type ReactionEmoji,
} from './reaction-payload';

const TOPIC = 'meet.reaction';
type Reaction = { id: number; emoji: ReactionEmoji; name: string; expires: number };

export function MeetingReactions({
  conferenceRef,
}: {
  conferenceRef: RefObject<HTMLDivElement | null>;
}) {
  const room = useRoomContext();
  const emojiStore = useEmojiStore();
  const connection = useConnectionState(room);
  const controlBar = useConferenceControlBar(conferenceRef);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const sequence = useRef(0);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);

  function showReaction(emoji: ReactionEmoji, name: string) {
    const reaction = { id: sequence.current++, emoji, name, expires: Date.now() + 4500 };
    setReactions((current) => [...current.slice(-4), reaction]);
  }

  useEffect(() => {
    const receive = (
      payload: Uint8Array,
      participant?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== TOPIC || !participant) return;
      const emoji = decodeReaction(payload);
      if (emoji) {
        showReaction(emoji, participant.name || participant.identity);
      }
    };
    room.on(RoomEvent.DataReceived, receive);
    const interval = window.setInterval(() => {
      setReactions((current) =>
        current.some((reaction) => reaction.expires <= Date.now())
          ? current.filter((reaction) => reaction.expires > Date.now())
          : current,
      );
    }, 500);
    return () => {
      room.off(RoomEvent.DataReceived, receive);
      window.clearInterval(interval);
    };
  }, [room]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  async function sendReaction(emoji: string) {
    if (busy.current) return;
    const payload = encodeReaction(emoji, emojiStore.emojis);
    const selected = payload && decodeReaction(payload);
    if (!payload || !selected) return;
    busy.current = true;
    setSending(true);
    setError(undefined);
    try {
      await room.localParticipant.publishData(payload, {
        reliable: true,
        topic: TOPIC,
      });
      showReaction(selected, room.localParticipant.name || 'You');
      setOpen(false);
      trigger.current?.focus();
    } catch {
      setError('Could not send reaction. Please try again.');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <>
      {controlBar &&
        createPortal(
          <div className="meeting-control">
            <button
              ref={trigger}
              className="lk-button meeting-icon-button"
              title="Reactions"
              type="button"
              aria-label="Reactions"
              aria-expanded={open}
              aria-haspopup="dialog"
              disabled={connection !== ConnectionState.Connected}
              onClick={() => setOpen(!open)}
            >
              <Icon name="smile" />
            </button>
            {open && (
              <div
                ref={menu}
                className="meeting-reaction-picker"
                role="dialog"
                aria-label="Choose a reaction"
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') event.stopPropagation();
                }}
                onKeyUp={(event) => event.stopPropagation()}
              >
                <div className="meeting-reaction-standard-grid">
                  {STANDARD_REACTIONS.map(({ value, label }) => (
                    <button
                      key={label}
                      className="lk-button"
                      type="button"
                      title={label}
                      aria-label={label}
                      disabled={sending}
                      onClick={() => void sendReaction(value)}
                    >
                      <span aria-hidden="true">{value}</span>
                    </button>
                  ))}
                </div>
                <EmojiStore
                  store={emojiStore}
                  onChoose={(value) => void sendReaction(value)}
                  disabled={sending}
                />
              </div>
            )}
            {error && (
              <div className="meeting-control-error" role="alert">
                {error}
              </div>
            )}
          </div>,
          controlBar,
        )}
      <div className="meeting-reactions" role="status" aria-live="polite" aria-atomic="false">
        {reactions.map((reaction) => (
          <div
            className={`meeting-reaction${reaction.emoji.src ? ' meeting-reaction-image' : ''}`}
            key={reaction.id}
          >
            <span className="meeting-reaction-emoji">
              {reaction.emoji.src ? (
                <Image
                  src={reaction.emoji.src}
                  alt={reaction.emoji.label}
                  width={128}
                  height={128}
                  unoptimized
                />
              ) : (
                reaction.emoji.value
              )}
            </span>
            <span className="meeting-reaction-name">{reaction.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}
