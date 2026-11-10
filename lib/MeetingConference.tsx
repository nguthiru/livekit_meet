// Adapted from LiveKit VideoConference to expose an icon-only control bar.
'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { RoomEvent, Track } from 'livekit-client';
import {
  CarouselLayout,
  ChatToggle,
  ChatIcon,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
  useRoomContext,
  useLocalParticipantPermissions,
  isTrackReference,
  type TrackReferenceOrPlaceholder,
  type WidgetState,
  type VideoConferenceProps,
} from '@livekit/components-react';
import { MeetingChat } from './MeetingChat';
import { RaisedHands } from './MeetingHands';
import { MeetingControlBar } from './MeetingControlBar';
import { preserveAudioDevices } from './preserveAudioDevices';

function isEqualTrackRef(a?: TrackReferenceOrPlaceholder, b?: TrackReferenceOrPlaceholder) {
  if (!a || !b) return false;
  if (isTrackReference(a) && isTrackReference(b))
    return a.publication.trackSid === b.publication.trackSid;
  return a.participant.identity === b.participant.identity && a.source === b.source;
}

export function MeetingConference({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  ...props
}: VideoConferenceProps) {
  const room = useRoomContext();
  React.useEffect(() => {
    if (navigator.mediaDevices) return preserveAudioDevices(room, navigator.mediaDevices);
  }, [room]);
  const conferenceRef = React.useRef<HTMLDivElement>(null);
  const [chatSlot, setChatSlot] = React.useState<HTMLElement | null>(null);
  const permissions = useLocalParticipantPermissions();
  React.useEffect(() => {
    setChatSlot(
      conferenceRef.current
        ?.closest('.lk-room-container')
        ?.querySelector<HTMLElement>('[data-meeting-chat-slot]') ?? null,
    );
  }, []);
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const widgetUpdate = (state: WidgetState) => {
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = React.useMemo(
    () =>
      tracks
        .filter(isTrackReference)
        .filter((track) => track.publication.source === Track.Source.ScreenShare),
    [tracks],
  );
  const pinDispatch = layoutContext.pin.dispatch;
  const screenShareState = screenShareTracks
    .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
    .join();

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      pinDispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      pinDispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        pinDispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  }, [screenShareTracks, screenShareState, focusTrack, tracks, pinDispatch]);

  return (
    <div className="lk-video-conference" {...props} ref={conferenceRef}>
      {typeof window !== 'undefined' && (
        <LayoutContextProvider value={layoutContext} onWidgetChange={widgetUpdate}>
          {chatSlot &&
            permissions?.canPublishData &&
            createPortal(
              <ChatToggle
                className="icon-button meeting-header-chat"
                aria-label={widgetState.showChat ? 'Close chat' : 'Open chat'}
                title={widgetState.showChat ? 'Close chat' : 'Open chat'}
              >
                <ChatIcon />
              </ChatToggle>,
              chatSlot,
            )}
          <div className="lk-video-conference-inner">
            <RaisedHands />
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  {focusTrack && <FocusLayout trackRef={focusTrack} />}
                </FocusLayoutContainer>
              </div>
            )}
            <MeetingControlBar controls={{ chat: false, settings: !!SettingsComponent }} />
          </div>
          <MeetingChat
            style={{ display: widgetState.showChat ? 'grid' : 'none' }}
            messageFormatter={chatMessageFormatter}
            messageEncoder={chatMessageEncoder}
            messageDecoder={chatMessageDecoder}
          />
          {SettingsComponent && (
            <div
              className="lk-settings-menu-modal"
              style={{ display: widgetState.showSettings ? 'block' : 'none' }}
            >
              <SettingsComponent />
            </div>
          )}
        </LayoutContextProvider>
      )}
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
