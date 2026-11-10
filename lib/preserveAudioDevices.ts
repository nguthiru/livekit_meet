import { Room, RoomEvent } from 'livekit-client';

const audioKinds = ['audioinput', 'audiooutput'] as const;
type AudioKind = (typeof audioKinds)[number];

/** Keep named audio selections when a display/dock changes device enumeration. */
export function preserveAudioDevices(room: Room, devices: MediaDevices) {
  const preferred = new Map<AudioKind, string>();
  let changing = false;
  let disposed = false;
  let revision = 0;

  function remember(kind: MediaDeviceKind, id: string) {
    if (changing || !audioKinds.includes(kind as AudioKind)) return;
    preferred.set(kind as AudioKind, id);
  }
  for (const kind of audioKinds) {
    const id = room.getActiveDevice(kind);
    if (id) remember(kind, id);
  }

  // LiveKit's native devicechange listener awaits enumeration before switching
  // devices, so snapshot intent here before its automatic fallback emits changes.
  function beforeChange() {
    changing = true;
    revision += 1;
  }

  async function afterChange() {
    if (!changing || disposed) return;
    const currentRevision = revision;
    try {
      const available = await devices.enumerateDevices();
      for (const kind of audioKinds) {
        if (disposed || revision !== currentRevision) return;
        const id = preferred.get(kind);
        // System-default aliases deliberately follow the OS. If a named device
        // is temporarily absent, retain intent until a later devicechange.
        if (!id || id === 'default' || id === 'communications') continue;
        if (!available.some((device) => device.kind === kind && device.deviceId === id)) continue;
        if (room.getActiveDevice(kind) !== id) {
          try {
            await room.switchActiveDevice(kind, id);
          } catch (error) {
            // Failure to reopen a microphone must not prevent speaker recovery.
            console.warn(`Could not restore selected ${kind} after a device change`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Could not restore the selected audio devices after a device change', error);
    } finally {
      if (revision === currentRevision) changing = false;
    }
  }

  devices.addEventListener('devicechange', beforeChange);
  room.on(RoomEvent.ActiveDeviceChanged, remember);
  room.on(RoomEvent.MediaDevicesChanged, afterChange);
  return () => {
    disposed = true;
    devices.removeEventListener('devicechange', beforeChange);
    room.off(RoomEvent.ActiveDeviceChanged, remember);
    room.off(RoomEvent.MediaDevicesChanged, afterChange);
  };
}
