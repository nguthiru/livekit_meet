'use client';

import {
  useConnectionState,
  useLocalParticipantPermissions,
  useParticipantAttribute,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState, Participant, RoomEvent } from 'livekit-client';
import { useRef, useState } from 'react';
import { Icon } from './Icons';

export const HAND_RAISED_ATTRIBUTE = 'meet.handRaised';

export function RaiseHandButton() {
  const room = useRoomContext();
  const connection = useConnectionState(room);
  const permissions = useLocalParticipantPermissions();
  const raised =
    useParticipantAttribute(HAND_RAISED_ATTRIBUTE, {
      participant: room.localParticipant,
    }) === 'true';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const allowed = permissions?.canUpdateMetadata === true;
  const label = pending
    ? raised
      ? 'Lowering hand…'
      : 'Raising hand…'
    : raised
      ? 'Lower hand'
      : 'Raise hand';

  async function toggleHand() {
    if (busy.current || !allowed || connection !== ConnectionState.Connected) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await room.localParticipant.setAttributes({
        [HAND_RAISED_ATTRIBUTE]: raised ? '' : 'true',
      });
    } catch {
      setError(`Could not ${raised ? 'lower' : 'raise'} your hand. Please try again.`);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="meeting-control">
      <button
        className="lk-button meeting-icon-button"
        type="button"
        aria-label={label}
        title={allowed ? label : 'Hand raising is not enabled for this meeting'}
        aria-pressed={raised}
        aria-busy={pending}
        disabled={pending || !allowed || connection !== ConnectionState.Connected}
        onClick={toggleHand}
      >
        <Icon name={pending ? 'loader' : 'hand'} className={pending ? 'icon-spin' : undefined} />
      </button>
      {error && (
        <div className="meeting-control-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function RaisedHand({ participant }: { participant: Participant }) {
  const raised = useParticipantAttribute(HAND_RAISED_ATTRIBUTE, { participant }) === 'true';
  if (!raised) return null;
  return (
    <li>
      <Icon name="hand" />
      <span>
        {participant.isLocal
          ? 'Your hand is raised'
          : `${participant.name || participant.identity} raised a hand`}
      </span>
    </li>
  );
}

export function RaisedHands() {
  const participants = useParticipants({ updateOnlyOn: [RoomEvent.ParticipantNameChanged] });
  return (
    <ul
      className="meeting-raised-hands"
      aria-label="Raised hands"
      aria-live="polite"
      aria-relevant="all"
    >
      {participants
        .filter((participant) => !participant.isAgent)
        .map((participant) => (
          <RaisedHand key={participant.identity} participant={participant} />
        ))}
    </ul>
  );
}
