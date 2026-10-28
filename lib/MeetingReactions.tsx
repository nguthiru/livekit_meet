'use client';

import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState, Participant, RoomEvent } from 'livekit-client';
import { RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { useConferenceControlBar } from './useConferenceControlBar';

const TOPIC = 'meet.reaction';
const REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '😮', label: 'Surprised' },
];

type Reaction = { id: number; emoji: string; name: string; expires: number };

export function MeetingReactions({
  conferenceRef,
}: {
  conferenceRef: RefObject<HTMLDivElement | null>;
}) {
  const room = useRoomContext();
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

  function showReaction(emoji: string, name: string) {
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
      if (topic !== TOPIC || !participant || payload.byteLength > 100) return;
      const emoji = new TextDecoder().decode(payload);
      if (REACTIONS.some((reaction) => reaction.emoji === emoji)) {
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
    busy.current = true;
    setSending(true);
    setError(undefined);
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(emoji), {
        reliable: true,
        topic: TOPIC,
      });
      showReaction(emoji, room.localParticipant.name || 'You');
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
              >
                {REACTIONS.map(({ emoji, label }) => (
                  <button
                    key={label}
                    className="lk-button"
                    type="button"
                    title={label}
                    aria-label={label}
                    disabled={sending}
                    onClick={() => void sendReaction(emoji)}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
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
          <div className="meeting-reaction" key={reaction.id}>
            <span className="meeting-reaction-emoji">{reaction.emoji}</span>
            <span className="meeting-reaction-name">{reaction.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}
