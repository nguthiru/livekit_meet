'use client';

import React from 'react';
import Link from 'next/link';
import { BrandedPreJoin } from '@/lib/BrandedPreJoin';
import { Brand } from '@/lib/Brand';
import { Icon } from '@/lib/Icons';
import { MeetingHeader } from '@/lib/MeetingHeader';
import { MeetingConference } from '@/lib/MeetingConference';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { formatChatMessageLinks, LocalUserChoices, RoomContext } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  Track,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { TranscriptionButton } from './TranscriptionButton';
import { MeetingReactions } from '@/lib/MeetingReactions';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  singlePeerConnection: boolean;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [joinError, setJoinError] = React.useState('');
  const [joining, setJoining] = React.useState(false);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(
    async (values: LocalUserChoices) => {
      setJoining(true);
      setJoinError('');
      try {
        const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
        url.searchParams.append('roomName', props.roomName);
        url.searchParams.append('participantName', values.username);
        if (props.region) url.searchParams.append('region', props.region);
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Could not join the meeting. Please try again.');
        const details: ConnectionDetails = await response.json();
        setPreJoinChoices(values);
        setConnectionDetails(details);
      } catch (error) {
        setJoinError(error instanceof Error ? error.message : 'Could not join the meeting.');
      } finally {
        setJoining(false);
      }
    },
    [props.roomName, props.region],
  );
  const handlePreJoinError = React.useCallback((error: Error) => {
    console.error(error);
    setJoinError(
      'Camera or microphone unavailable. Check your permissions, or join with them turned off.',
    );
  }, []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div className="prejoin-page">
          <header className="prejoin-header">
            <Brand />
            <Link href="/" className="icon-button" aria-label="Back to lobby" title="Back to lobby">
              <Icon name="back" />
            </Link>
          </header>
          <section className="prejoin-workbench">
            <div className="prejoin-intro">
              <span className="section-eyebrow">YOUR NEXT CONVERSATION</span>
              <h1>
                A quick check.
                <br />
                Then, say hello.
              </h1>
              <p>
                Make yourself comfortable. Check your camera and microphone before joining your
                crew.
              </p>
              <div className="prejoin-room">
                <Icon name="video" />
                <span>
                  <small>You’re joining</small>
                  <strong>{props.roomName}</strong>
                </span>
              </div>
              <div className="prejoin-tip">
                <Icon name="shield" />
                <span>
                  Your camera and microphone are yours to control, before and during the call.
                </span>
              </div>
            </div>
            <div className="prejoin-preview">
              <div className="preview-caption">
                <span className="connection-dot connected" />
                Your space, before you join
              </div>
              <div aria-busy={joining} className={joining ? 'prejoin-loading' : undefined}>
                <BrandedPreJoin
                  defaults={preJoinDefaults}
                  onSubmit={handlePreJoinSubmit}
                  onError={handlePreJoinError}
                />
              </div>
              <p className="prejoin-caption">
                {joining ? 'Connecting you to your crew…' : 'All set? Your crew is one click away.'}
              </p>
              {joinError && (
                <p className="prejoin-error" role="alert">
                  {joinError}
                </p>
              )}
            </div>
          </section>
          <p className="prejoin-footer">Different places. Same adventure.</p>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{
            codec: props.codec,
            hq: props.hq,
            singlePeerConnection: props.singlePeerConnection,
          }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
    singlePeerConnection: boolean;
  };
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    // VP8 is the most interoperable baseline for browser screen sharing.
    // Callers can still opt into another codec with the codec query option.
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp8';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      // Screen shares need a single, sharp full-resolution stream. The
      // generic camera layers otherwise allow the bandwidth estimator to
      // select a blurry half-resolution layer when text is on screen.
      screenShareEncoding: {
        maxBitrate: 4_500_000,
        maxFramerate: 15,
      },
      screenShareSimulcastLayers: [],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: props.options.singlePeerConnection,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    const handleLocalTrackPublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare && publication.track) {
        publication.track.mediaStreamTrack.contentHint = 'detail';
      }
    };

    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const lowPowerMode = useLowCPUOptimizer(room);
  const conferenceRef = React.useRef<HTMLDivElement>(null);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  return (
    <div className="lk-room-container yoonka-room">
      <RoomContext.Provider value={room}>
        <MeetingHeader />
        <KeyboardShortcuts />
        <div ref={conferenceRef} className="meeting-conference">
          <MeetingConference
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
          />
          <TranscriptionButton conferenceRef={conferenceRef} />
          <MeetingReactions conferenceRef={conferenceRef} />
        </div>
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}
