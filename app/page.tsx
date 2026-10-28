'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import { Brand } from '@/lib/Brand';
import { Icon } from '@/lib/Icons';
import styles from '../styles/Home.module.css';

function MeetingEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const custom = searchParams?.get('tab') === 'custom';
  const [e2ee, setE2ee] = useState(false);
  const [passphrase, setPassphrase] = useState(() => randomString(64));
  const [roomName, setRoomName] = useState('');
  const [joinValue, setJoinValue] = useState('');
  const [error, setError] = useState('');

  function joinMeeting(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const value = joinValue.trim();
    if (!value) return;
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (!/^\/rooms\/[^/]+\/?$/.test(url.pathname)) throw new Error();
        router.push(`${url.pathname}${url.search}${url.hash}`);
      } catch {
        setError('Enter a meeting link or room name.');
      }
    } else {
      router.push(`/rooms/${encodeURIComponent(value)}`);
    }
  }

  function startMeeting(event: React.FormEvent) {
    event.preventDefault();
    const room = roomName.trim() || generateRoomId();
    router.push(
      `/rooms/${encodeURIComponent(room)}${e2ee ? `#${encodePassphrase(passphrase)}` : ''}`,
    );
  }

  function connectCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      liveKitUrl: String(data.get('serverUrl')),
      token: String(data.get('token')),
    });
    router.push(`/custom?${params}${e2ee ? `#${encodePassphrase(passphrase)}` : ''}`);
  }

  const encryption = (
    <>
      <label className={styles.encryption}>
        <input type="checkbox" checked={e2ee} onChange={(event) => setE2ee(event.target.checked)} />
        End-to-end encryption
        <Icon name="shield" width={16} height={16} />
      </label>
      {e2ee && (
        <label className={styles.field}>
          Shared passphrase
          <input
            type="password"
            value={passphrase}
            required
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <small>Share this with your crew. Transcription requires an unencrypted room.</small>
        </label>
      )}
    </>
  );

  return (
    <div className={styles.entry}>
      <div className={styles.entryHeading}>
        <h2>{custom ? 'Your server. Your space.' : 'Bring your crew together.'}</h2>
        <button
          className="icon-button"
          type="button"
          title={custom ? 'Back to meetings' : 'Custom server connection'}
          aria-label={custom ? 'Back to meetings' : 'Custom server connection'}
          onClick={() => router.push(custom ? '/' : '/?tab=custom')}
        >
          <Icon name={custom ? 'back' : 'server'} />
        </button>
      </div>
      {custom ? (
        <form className={styles.customForm} onSubmit={connectCustom}>
          <label className={styles.field}>
            Server URL
            <input
              name="serverUrl"
              type="url"
              placeholder="wss://your-server.livekit.cloud"
              required
            />
          </label>
          <label className={styles.field}>
            Access token
            <textarea name="token" placeholder="Paste your participant token" rows={3} required />
          </label>
          {encryption}
          <div className={styles.actionLabel}>
            <span>Connect to your server</span>
            <button
              className="icon-button primary"
              aria-label="Connect to server"
              title="Connect to server"
            >
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      ) : (
        <>
          <form onSubmit={startMeeting} className={styles.startForm}>
            <label htmlFor="room-name">Start a new meeting</label>
            <div className={styles.inputAction}>
              <input
                id="room-name"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Name your room (optional)"
                maxLength={100}
              />
              <button
                className="icon-button primary"
                type="submit"
                aria-label="Start a new meeting"
                title="Start a new meeting"
              >
                <Icon name="video" />
              </button>
            </div>
            {encryption}
          </form>
          <div className={styles.or}>
            <span />
            or join your team
            <span />
          </div>
          <form onSubmit={joinMeeting} className={styles.joinForm}>
            <label className="sr-only" htmlFor="meeting-link">
              Meeting link or room name
            </label>
            <div className={styles.inputAction}>
              <Icon name="link" />
              <input
                id="meeting-link"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="Meeting link or room name"
                required
              />
              <button
                className="icon-button"
                type="submit"
                aria-label="Join meeting"
                title="Join meeting"
              >
                <Icon name="arrow" />
              </button>
            </div>
          </form>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <main className={styles.page}>
      <header className={styles.navigation}>
        <Brand />
        <div className={styles.navRight}>
          <span>A little closer, wherever you are.</span>
          <a
            className="icon-button"
            href="https://www.yoonka.com/"
            title="Visit Yoonka"
            aria-label="Visit Yoonka"
          >
            <Icon name="arrow" style={{ transform: 'rotate(-45deg)' }} />
          </a>
        </div>
      </header>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span /> A space for your next big idea
          </div>
          <h1>
            Great things
            <br />
            start with <span>hello.</span>
          </h1>
          <p className={styles.intro}>
            Gather your people. Share your screen. Make a little progress, together.
          </p>
          <Suspense fallback={<p>Preparing your meeting space…</p>}>
            <MeetingEntry />
          </Suspense>
        </div>
        <div className={styles.visual}>
          <Image
            src="/brand/airship.webp"
            alt="An adventurous crew gathering beneath a copper airship in a sunlit city"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 35vw"
            className={styles.airship}
          />
          <div className={styles.imageTint} />
          <div className={styles.visualTop}>
            <svg
              className={styles.compass}
              viewBox="0 0 120 120"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="60" cy="60" r="57" className={styles.compassSurface} />
              <circle cx="60" cy="60" r="53" className={styles.compassRim} />
              <g className={styles.compassDial}>
                {Array.from({ length: 32 }, (_, index) => (
                  <path
                    key={index}
                    d={`M60 10v${index % 4 === 0 ? 7 : 3}`}
                    transform={`rotate(${index * 11.25} 60 60)`}
                  />
                ))}
              </g>
              <g className={styles.compassLabels}>
                <text x="60" y="29" textAnchor="middle">
                  N
                </text>
                <text x="94" y="63" textAnchor="middle">
                  E
                </text>
                <text x="60" y="98" textAnchor="middle">
                  S
                </text>
                <text x="26" y="63" textAnchor="middle">
                  W
                </text>
              </g>
              <g className={styles.compassNeedle}>
                <path d="m60 33 8 27-8-4-8 4Z" className={styles.compassNorth} />
                <path d="m60 87-8-27 8 4 8-4Z" className={styles.compassSouth} />
              </g>
              <circle cx="60" cy="60" r="3" className={styles.compassPivot} />
            </svg>
            <span>
              Different places.
              <br />
              Same adventure.
            </span>
          </div>
          <div className={styles.visualBottom}>
            <span>THE NEXT CHAPTER STARTS HERE</span>
            <h2>
              Your crew.
              <br />
              One room.
            </h2>
            <div className={styles.imageRule} />
            <p>Powered by people. Connected by Yoonka.</p>
          </div>
        </div>
      </section>
      <section className={styles.features} aria-label="Meeting features">
        <div>
          <Icon name="video" />
          <span>
            <strong>Room for everyone</strong>
            <small>Video, audio & screen sharing</small>
          </span>
        </div>
        <div>
          <Icon name="transcript" />
          <span>
            <strong>Stay in the conversation</strong>
            <small>Start and stop transcription in a click</small>
          </span>
        </div>
        <div>
          <Icon name="smile" />
          <span>
            <strong>A little more human</strong>
            <small>Say it with a live reaction</small>
          </span>
        </div>
      </section>
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Yoonka</span>
        <span>Built for your team. Powered by LiveKit.</span>
        <a href="https://www.yoonka.com/">
          Part of the Yoonka universe <Icon name="arrow" width={14} />
        </a>
      </footer>
    </main>
  );
}
