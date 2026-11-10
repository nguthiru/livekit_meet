'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { Icon } from './Icons';

type Member = { identity: string; name: string; isHost: boolean };
const HostContext = createContext({
  isHost: false,
  participants: [] as Member[],
  refresh: async () => {},
});
export const useMeetingHosts = () => useContext(HostContext);

export function MeetingHostProvider({ children }: { children: React.ReactNode }) {
  const room = useRoomContext();
  const connection = useConnectionState(room);
  const [roles, setRoles] = useState({ isHost: false, participants: [] as Member[] });
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (room.state !== ConnectionState.Connected) return;
      try {
        const response = await fetch(`/api/hosts?roomName=${encodeURIComponent(room.name)}`, {
          cache: 'no-store',
          signal,
        });
        const data = await response.json();
        if (signal?.aborted) return;
        setRoles(response.ok ? data : { isHost: false, participants: [] });
      } catch {
        if (!signal?.aborted) setRoles({ isHost: false, participants: [] });
      }
    },
    [room],
  );
  useEffect(() => {
    if (connection !== ConnectionState.Connected) {
      setRoles({ isHost: false, participants: [] });
      return;
    }
    const controller = new AbortController();
    const update = () => void refresh(controller.signal);
    update();
    const timer = window.setInterval(update, 2000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [connection, refresh]);
  return <HostContext.Provider value={{ ...roles, refresh }}>{children}</HostContext.Provider>;
}

export function ManageHosts() {
  const room = useRoomContext();
  const { isHost, participants, refresh } = useMeetingHosts();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
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
  async function change(member: Member) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room.name,
          identity: member.identity,
          action: member.isHost ? 'remove' : 'add',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change host');
    } finally {
      setPending(false);
    }
  }
  if (!isHost) return null;
  return (
    <div ref={root} className="meeting-host-control">
      <button
        ref={trigger}
        className="icon-button"
        type="button"
        title="Manage hosts"
        aria-label="Manage hosts"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="shield" />
      </button>
      {open && (
        <section className="meeting-host-panel" role="dialog" aria-label="Manage meeting hosts">
          <h3>Meeting hosts</h3>
          <p>Hosts can manage recording, transcription and host roles.</p>
          {participants.map((member) => (
            <div className="meeting-host-row" key={member.identity}>
              <span>
                {member.name}
                {member.identity === room.localParticipant.identity ? ' (you)' : ''}
                <small>{member.isHost ? 'Host' : 'Participant'}</small>
              </span>
              <button
                className="lk-button"
                type="button"
                disabled={
                  pending || (member.isHost && participants.filter((p) => p.isHost).length === 1)
                }
                onClick={() => void change(member)}
              >
                {member.isHost ? 'Remove host' : 'Make host'}
              </button>
            </div>
          ))}
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}
