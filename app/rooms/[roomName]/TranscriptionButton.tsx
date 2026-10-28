'use client';

import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { Icon } from '@/lib/Icons';
import { ConnectionState } from 'livekit-client';
import { RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConferenceControlBar } from '@/lib/useConferenceControlBar';

export function TranscriptionButton({
  conferenceRef,
}: {
  conferenceRef: RefObject<HTMLDivElement | null>;
}) {
  const room = useRoomContext();
  const connection = useConnectionState(room);
  const controlBar = useConferenceControlBar(conferenceRef);
  const [active, setActive] = useState<boolean>();
  const [pending, setPending] = useState<'starting' | 'stopping'>();
  const [error, setError] = useState<string>();
  const requestVersion = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (connection !== ConnectionState.Connected) {
      setActive(undefined);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const updateStatus = async () => {
      if (busy.current || room.state !== ConnectionState.Connected) return;
      const version = requestVersion.current;
      try {
        const response = await fetch(
          `/api/transcription?roomName=${encodeURIComponent(room.name)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to check transcription status');
        if (!disposed && version === requestVersion.current) {
          setActive(result.active);
          setError(undefined);
        }
      } catch (error) {
        if (!disposed && version === requestVersion.current) {
          setError(error instanceof Error ? error.message : 'Unable to check transcription status');
        }
      }
    };
    void updateStatus();
    const interval = window.setInterval(updateStatus, 3000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [room, connection]);

  async function requestTranscription() {
    if (busy.current || active === undefined) return;
    busy.current = true;
    requestVersion.current += 1;
    setPending(active ? 'stopping' : 'starting');
    setError(undefined);
    try {
      const response = await fetch('/api/transcription', {
        method: active ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: room.name }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? `Unable to ${active ? 'stop' : 'start'} transcription`);
      }
      setActive(!active);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to change transcription');
    } finally {
      busy.current = false;
      setPending(undefined);
    }
  }

  const label =
    pending === 'starting'
      ? 'Starting…'
      : pending === 'stopping'
        ? 'Stopping…'
        : active === undefined
          ? error
            ? 'Transcription unavailable'
            : 'Checking transcription…'
          : active
            ? 'Stop transcription'
            : 'Start transcription';

  if (!controlBar) return null;

  return createPortal(
    <div className="meeting-control">
      <button
        className="lk-button meeting-icon-button"
        type="button"
        onClick={requestTranscription}
        disabled={!!pending || active === undefined || connection !== ConnectionState.Connected}
        aria-busy={!!pending || (active === undefined && !error)}
        aria-pressed={active ?? false}
        aria-label={label}
        title={error ?? label}
      >
        <Icon
          name={
            pending || (active === undefined && !error) ? 'loader' : active ? 'stop' : 'transcript'
          }
          className={pending || (active === undefined && !error) ? 'icon-spin' : undefined}
        />
      </button>
      {error && (
        <div className="meeting-control-error" role="alert">
          {error}
        </div>
      )}
    </div>,
    controlBar,
  );
}
