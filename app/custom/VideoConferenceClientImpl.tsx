'use client';

import { formatChatMessageLinks, RoomContext, VideoConference } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  LogLevel,
  Room,
  RoomConnectOptions,
  RoomOptions,
  RoomEvent,
  Track,
  VideoPresets,
  type VideoCodec,
} from 'livekit-client';
import { DebugMode } from '@/lib/Debug';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

export function VideoConferenceClientImpl(props: {
  liveKitUrl: string;
  token: string;
  codec: VideoCodec | undefined;
  singlePeerConnection: boolean | undefined;
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);

  const roomOptions = useMemo((): RoomOptions => {
    return {
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
        // Keep screen sharing at one full-resolution layer so shared text
        // does not become soft when adaptive streaming changes camera layers.
        screenShareEncoding: {
          maxBitrate: 4_500_000,
          maxFramerate: 15,
        },
        screenShareSimulcastLayers: [],
        red: !e2eeEnabled,
        videoCodec: props.codec ?? 'vp9',
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
      singlePeerConnection: props.singlePeerConnection,
    };
  }, [e2eeEnabled, props.codec, keyProvider, worker]);

  const room = useMemo(() => new Room(roomOptions), [roomOptions]);

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  useEffect(() => {
    if (e2eeEnabled) {
      keyProvider.setKey(e2eePassphrase).then(() => {
        room.setE2EEEnabled(true).then(() => {
          setE2eeSetupComplete(true);
        });
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, keyProvider, room, setE2eeSetupComplete]);

  useEffect(() => {
    const handleLocalTrackPublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare && publication.track) {
        publication.track.mediaStreamTrack.contentHint = 'detail';
      }
    };

    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    if (e2eeSetupComplete) {
      room.connect(props.liveKitUrl, props.token, connectOptions).catch((error) => {
        console.error(error);
      });
      room.localParticipant.enableCameraAndMicrophone().catch((error) => {
        console.error(error);
      });
    }
    return () => {
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    };
  }, [room, props.liveKitUrl, props.token, connectOptions, e2eeSetupComplete]);

  useLowCPUOptimizer(room);

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={
            process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
          }
        />
        <DebugMode logLevel={LogLevel.debug} />
      </RoomContext.Provider>
    </div>
  );
}
