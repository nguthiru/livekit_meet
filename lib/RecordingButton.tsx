'use client';

import { useIsRecording, useRoomContext } from '@livekit/components-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function RecordingButton() {
  const room = useRoomContext();
  const recording = useIsRecording();
  const [pending, setPending] = useState(false);

  async function toggleRecording() {
    if (pending) return;
    setPending(true);
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
      setPending(false);
    }
  }

  const label = pending ? 'Please wait…' : recording ? 'Stop recording' : 'Record';
  return (
    <button
      className="lk-button"
      type="button"
      disabled={pending || room.isE2EEEnabled}
      aria-pressed={recording}
      aria-label={label}
      title={room.isE2EEEnabled ? 'Recording is unavailable in encrypted rooms' : label}
      onClick={toggleRecording}
    >
      {recording ? '■' : '●'} {label}
    </button>
  );
}
