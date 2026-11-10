'use client';

import { useIsRecording, useRoomContext } from '@livekit/components-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Icon } from './Icons';

export function RecordingButton() {
  const room = useRoomContext();
  const recording = useIsRecording();
  const [pending, setPending] = useState<'starting' | 'stopping'>();

  async function toggleRecording() {
    if (pending) return;
    setPending(recording ? 'stopping' : 'starting');
    try {
      const response = await fetch('/api/record', {
        method: recording ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: room.name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast(recording ? 'Recording is finishing and uploading' : 'Recording is starting');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change recording');
    } finally {
      setPending(undefined);
    }
  }

  const label =
    pending === 'starting'
      ? 'Starting recording…'
      : pending === 'stopping'
        ? 'Stopping recording…'
        : recording
          ? 'Stop recording'
          : 'Start recording';
  return (
    <button
      className="lk-button meeting-icon-button"
      type="button"
      disabled={!!pending || room.isE2EEEnabled}
      aria-busy={!!pending}
      aria-pressed={recording}
      aria-label={label}
      title={room.isE2EEEnabled ? 'Recording is unavailable in encrypted rooms' : label}
      onClick={toggleRecording}
    >
      <Icon
        name={pending ? 'loader' : recording ? 'stop' : 'record'}
        className={pending ? 'icon-spin' : undefined}
      />
    </button>
  );
}
