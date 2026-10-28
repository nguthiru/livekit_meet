'use client';
import { useConnectionState, useParticipants, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { useState } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icons';

export function MeetingHeader() {
  const room = useRoomContext();
  const participants = useParticipants();
  const state = useConnectionState();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copyLink() {
    try {
      // Custom connection URLs contain a participant token and must not be shared.
      if (window.location.pathname === '/custom' || window.location.pathname === '/custom/') {
        setError('Invite others with their own access token from your meeting organizer.');
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setError('');
    } catch {
      setError('Could not copy the link. Copy it from your address bar.');
    }
  }
  return (
    <header className="meeting-header">
      <Brand />
      <div className="meeting-room-title">
        <span
          className={`connection-dot ${state === ConnectionState.Connected ? 'connected' : ''}`}
        />
        <span>{room.name || 'Your meeting'}</span>
        <small>{state === ConnectionState.Connected ? 'Together, in real time' : state}</small>
      </div>
      <div className="meeting-header-actions">
        <span className="meeting-people" title="Participants">
          <Icon name="users" width={18} />
          {participants.filter((p) => !p.isAgent).length}
        </span>
        <button
          className="icon-button"
          type="button"
          onClick={copyLink}
          onBlur={() => setCopied(false)}
          title={copied ? 'Link copied' : 'Copy meeting link'}
          aria-label={copied ? 'Meeting link copied' : 'Copy meeting link'}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </div>
      {error && (
        <div className="meeting-control-error" role="alert">
          {error}
          <button
            className="icon-button"
            title="Dismiss"
            aria-label="Dismiss"
            onClick={() => setError('')}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <span className="sr-only" role="status">
        {copied ? 'Meeting link copied' : ''}
      </span>
    </header>
  );
}
