'use client';

import { useRoomContext } from '@livekit/components-react';
import { Participant, RoomEvent } from 'livekit-client';
import { RefObject, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const TRANSCRIPTION_AGENT_NAME = 'transcriber';

function isTranscriptionAgent(participant: Participant): boolean {
  return participant.isAgent && participant.attributes['lk.agent.name'] === TRANSCRIPTION_AGENT_NAME;
}

export function TranscriptionButton({
  conferenceRef,
}: {
  conferenceRef: RefObject<HTMLDivElement | null>;
}) {
  const room = useRoomContext();
  const [controlBar, setControlBar] = useState<HTMLElement>();
  const [dispatching, setDispatching] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const updateAgentState = () => {
      const joined = [...room.remoteParticipants.values()].some(isTranscriptionAgent);
      setAgentJoined(joined);
      if (joined) setDispatching(false);
    };

    updateAgentState();
    room.on(RoomEvent.ParticipantConnected, updateAgentState);
    room.on(RoomEvent.ParticipantAttributesChanged, updateAgentState);
    room.on(RoomEvent.ParticipantDisconnected, updateAgentState);

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateAgentState);
      room.off(RoomEvent.ParticipantAttributesChanged, updateAgentState);
      room.off(RoomEvent.ParticipantDisconnected, updateAgentState);
    };
  }, [room]);

  useEffect(() => {
    setControlBar(conferenceRef.current?.querySelector<HTMLElement>('.lk-control-bar') ?? undefined);
  }, [conferenceRef]);

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

  if (!controlBar) return null;

  return createPortal(
    <button
      className="lk-button"
      type="button"
      onClick={requestTranscription}
      disabled={dispatching || agentJoined}
      aria-busy={dispatching}
      title={error ?? 'Join the transcription agent to this call'}
    >
      {label}
    </button>,
    controlBar,
  );
}
