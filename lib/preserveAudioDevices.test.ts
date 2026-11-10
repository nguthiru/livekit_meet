import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Room, RoomEvent } from 'livekit-client';
import { preserveAudioDevices } from './preserveAudioDevices';

function fixture(input = 'chosen-mic', output = 'chosen-speaker') {
  const room = new EventEmitter();
  const native = new EventTarget();
  const active = new Map<MediaDeviceKind, string>([
    ['audioinput', input],
    ['audiooutput', output],
  ]);
  let available = [
    { kind: 'audioinput', deviceId: input },
    { kind: 'audiooutput', deviceId: output },
  ];
  const switchDevice = vi.fn(async (kind: MediaDeviceKind, id: string) => {
    active.set(kind, id);
    room.emit(RoomEvent.ActiveDeviceChanged, kind, id);
    return true;
  });
  const roomApi = Object.assign(room, {
    getActiveDevice: (kind: MediaDeviceKind) => active.get(kind),
    switchActiveDevice: switchDevice,
  }) as unknown as Room;
  const devices = Object.assign(native, {
    enumerateDevices: vi.fn(async () => available),
  }) as unknown as MediaDevices;
  const cleanup = preserveAudioDevices(roomApi, devices);
  async function monitorUpdate(fallback = true) {
    native.dispatchEvent(new Event('devicechange'));
    if (fallback) {
      for (const kind of ['audioinput', 'audiooutput'] as const) {
        active.set(kind, `monitor-${kind}`);
        room.emit(RoomEvent.ActiveDeviceChanged, kind, `monitor-${kind}`);
      }
    }
    room.emit(RoomEvent.MediaDevicesChanged);
    await vi.waitFor(() => expect(devices.enumerateDevices).toHaveBeenCalled());
    // Both the enumeration and sequential device switches resolve asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    room,
    native,
    active,
    switchDevice,
    devices,
    cleanup,
    monitorUpdate,
    setAvailable: (value: typeof available) => {
      available = value;
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('audio selection during monitor device-list changes', () => {
  it('restores both named devices after an automatic SDK fallback', async () => {
    const f = fixture();
    await f.monitorUpdate();
    expect(f.active.get('audioinput')).toBe('chosen-mic');
    expect(f.active.get('audiooutput')).toBe('chosen-speaker');
    expect(f.switchDevice.mock.calls).toEqual([
      ['audioinput', 'chosen-mic'],
      ['audiooutput', 'chosen-speaker'],
    ]);
    f.cleanup();
  });

  it('does not restart audio when the devices remain selected', async () => {
    const f = fixture();
    await f.monitorUpdate(false);
    expect(f.switchDevice).not.toHaveBeenCalled();
    f.cleanup();
  });

  it('leaves System default and communications aliases following the OS', async () => {
    const f = fixture('default', 'communications');
    await f.monitorUpdate();
    expect(f.switchDevice).not.toHaveBeenCalled();
    f.cleanup();
  });

  it('restores temporarily missing devices when they return without a page reload', async () => {
    const f = fixture();
    f.setAvailable([]);
    await f.monitorUpdate();
    expect(f.switchDevice).not.toHaveBeenCalled();
    f.setAvailable([
      { kind: 'audioinput', deviceId: 'chosen-mic' },
      { kind: 'audiooutput', deviceId: 'chosen-speaker' },
    ]);
    await f.monitorUpdate();
    expect(f.active.get('audioinput')).toBe('chosen-mic');
    expect(f.active.get('audiooutput')).toBe('chosen-speaker');
    f.cleanup();
  });

  it('respects subsequent participant selections rather than restoring old ones', async () => {
    const f = fixture();
    await f.switchDevice('audioinput', 'new-mic');
    await f.switchDevice('audiooutput', 'new-speaker');
    f.switchDevice.mockClear();
    f.setAvailable([
      { kind: 'audioinput', deviceId: 'new-mic' },
      { kind: 'audiooutput', deviceId: 'new-speaker' },
    ]);
    await f.monitorUpdate();
    expect(f.switchDevice.mock.calls).toEqual([
      ['audioinput', 'new-mic'],
      ['audiooutput', 'new-speaker'],
    ]);
    f.cleanup();
  });

  it('removes listeners when the meeting unmounts', async () => {
    const f = fixture();
    f.cleanup();
    f.native.dispatchEvent(new Event('devicechange'));
    f.room.emit(RoomEvent.MediaDevicesChanged);
    expect(f.devices.enumerateDevices).not.toHaveBeenCalled();
    expect(f.switchDevice).not.toHaveBeenCalled();
  });

  it('still restores the speaker when reopening the microphone fails', async () => {
    const f = fixture();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.switchDevice.mockRejectedValueOnce(new Error('Device is busy'));
    await f.monitorUpdate();
    expect(f.active.get('audiooutput')).toBe('chosen-speaker');
    expect(console.warn).toHaveBeenCalled();
    f.cleanup();
  });
});
