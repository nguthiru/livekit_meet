'use client';

import { useRoomContext } from '@livekit/components-react';
import { Participant, RoomEvent } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';

const TRANSCRIPTION_AGENT_NAME = 'transcriber';

function isTranscriptionAgent(participant: Participant): boolean {
  return (
    participant.name === TRANSCRIPTION_AGENT_NAME ||
    participant.identity.startsWith(`agent-${TRANSCRIPTION_AGENT_NAME}`)
  );
}

export function TranscriptionButton() {
  const room = useRoomContext();
  const [dispatching, setDispatching] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const remoteParticipants = useMemo(() => [...room.remoteParticipants.values()], [room]);

  useEffect(() => {
    setAgentJoined(remoteParticipants.some(isTranscriptionAgent));

    const handleParticipantConnected = (participant: Participant) => {
      if (isTranscriptionAgent(participant)) {
        setAgentJoined(true);
        setDispatching(false);
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [remoteParticipants, room]);

  async function requestTranscription() {
    setDispatching(true);
    setError(undefined);
    try {
      const response = await fetch('/api/transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: room.name }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to start transcription');
      }
    } catch (requestError) {
      setDispatching(false);
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to start transcription',
      );
    }
  }

  const label = agentJoined ? 'Transcribing' : dispatching ? 'Joining…' : 'Transcribe';

  return (
    <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 20 }}>
      <button
        className="lk-button"
        type="button"
        onClick={requestTranscription}
        disabled={dispatching || agentJoined}
        aria-busy={dispatching}
        title={error ?? 'Join the transcription agent to this call'}
      >
        {label}
      </button>
      {error && (
        <div role="alert" style={{ maxWidth: '18rem', marginTop: '0.5rem', color: '#ffb4b4' }}>
          {error}
        </div>
      )}
    </div>
  );
}
