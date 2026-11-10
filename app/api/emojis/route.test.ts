import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import sharp from 'sharp';
import { Readable } from 'node:stream';
import { GET, POST } from './route';
vi.mock('@/lib/emoji-store', () => import('../../../lib/emoji-store'));

const storage = vi.hoisted(() => ({
  putObject: vi.fn(),
  getObject: vi.fn(),
  listObjectsV2: vi.fn(),
}));
const getParticipant = vi.hoisted(() => vi.fn());
vi.mock('@/lib/emoji-storage', () => ({
  emojiStorage: () => ({ client: storage, bucket: 'test-emojis' }),
}));
vi.mock('livekit-server-sdk', async (original) => ({
  ...(await original<typeof import('livekit-server-sdk')>()),
  RoomServiceClient: vi.fn(function () {
    return { getParticipant };
  }),
}));

const key = '7335dcab-472d-4aaf-baff-2bb62c2be87a--crew-party.png';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'test-only-secret-that-is-at-least-32-characters');
  vi.stubEnv('LIVEKIT_API_URL', 'http://10.60.71.2:7880');
  getParticipant.mockResolvedValue({ identity: 'tester' });
  storage.listObjectsV2.mockImplementation(async function* () {
    yield { name: key };
    yield { name: 'invalid.svg' };
  });
});
afterEach(() => vi.unstubAllEnvs());

async function upload(data: Uint8Array, name = 'Crew party', session = true) {
  const form = new FormData();
  form.set('name', name);
  form.set('image', new File([data as BlobPart], 'emoji.png', { type: 'image/png' }));
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: 'tester',
    metadata: 'emoji-upload',
    ttl: '1h',
  });
  token.addGrant({ room: 'meeting' });
  return POST(
    new NextRequest('https://meet.test/api/emojis', {
      method: 'POST',
      body: form,
      headers: session ? { cookie: `meet-emoji-upload=${await token.toJwt()}` } : {},
    }),
  );
}

describe('shared emoji store', () => {
  it('preserves GIF frames, timing and loop settings while resizing', async () => {
    const frameSize = 256 * 128 * 3;
    const input = await sharp(
      Buffer.concat([
        Buffer.alloc(frameSize, Buffer.from([255, 0, 0])),
        Buffer.alloc(frameSize, Buffer.from([0, 255, 0])),
      ]),
      { raw: { width: 256, height: 256, channels: 3, pageHeight: 128 } },
    )
      .gif({ delay: [80, 140], loop: 3 })
      .toBuffer();
    expect((await upload(input, 'wave')).status).toBe(201);
    const [, object, buffer, , headers] = storage.putObject.mock.calls[0];
    expect(object).toMatch(/--wave\.gif$/);
    expect(headers['Content-Type']).toBe('image/gif');
    const metadata = await sharp(buffer, { animated: true }).metadata();
    expect(metadata.pages).toBe(2);
    expect(metadata.width).toBe(128);
    expect(metadata.pageHeight).toBe(64);
    expect(metadata.delay).toEqual([80, 140]);
    expect(metadata.loop).toBe(3);
    const first = await sharp(buffer, { page: 0 }).raw().toBuffer();
    const second = await sharp(buffer, { page: 1 }).raw().toBuffer();
    expect(first.equals(second)).toBe(false);
  });
  it('lists and serves animated GIFs with the correct content type', async () => {
    const gifKey = key.replace('.png', '.gif');
    storage.listObjectsV2.mockImplementationOnce(async function* () {
      yield { name: gifKey };
    });
    const listed = await GET(new NextRequest('https://meet.test/api/emojis'));
    expect((await listed.json()).emojis[0].src).toContain('.gif');
    storage.getObject.mockResolvedValueOnce(Readable.from([Buffer.from('GIF89a')]));
    const image = await GET(new NextRequest(`https://meet.test/api/emojis?image=${gifKey}`));
    expect(image.headers.get('content-type')).toBe('image/gif');
    expect(await image.text()).toBe('GIF89a');
  });
  it('lists only valid emoji objects with same-origin image URLs', async () => {
    const response = await GET(new NextRequest('https://meet.test/api/emojis'));
    const { emojis } = await response.json();
    expect(emojis).toEqual([
      {
        label: 'crew party',
        value: ':custom_7335dcab-472d-4aaf-baff-2bb62c2be87a:',
        src: `/api/emojis?image=${key}`,
      },
    ]);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('normalizes uploaded images to at most 128 pixels before storing', async () => {
    const input = await sharp({
      create: { width: 300, height: 200, channels: 4, background: 'red' },
    })
      .png()
      .toBuffer();
    const response = await upload(input);
    expect(response.status).toBe(201);
    expect(getParticipant).toHaveBeenCalledWith('meeting', 'tester');
    const [bucket, object, buffer, size, metadata] = storage.putObject.mock.calls[0];
    expect(bucket).toBe('test-emojis');
    expect(object).toMatch(/^[0-9a-f-]{36}--crew-party\.png$/);
    expect(size).toBe(buffer.length);
    expect(metadata['Content-Type']).toBe('image/png');
    const result = await sharp(buffer).metadata();
    expect(result.width).toBe(128);
    expect(result.height).toBeLessThanOrEqual(128);
  });
  it('rejects anonymous uploads and participants who have left the room', async () => {
    expect((await upload(new Uint8Array([0]), 'name', false)).status).toBe(401);
    getParticipant.mockRejectedValueOnce(new Error('not present'));
    expect((await upload(new Uint8Array([0]))).status).toBe(401);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
  it('rejects SVG and invalid images even when their upload MIME type says PNG', async () => {
    expect(
      (
        await upload(
          new TextEncoder().encode(
            '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>',
          ),
        )
      ).status,
    ).toBe(400);
    expect((await upload(new TextEncoder().encode('invalid'))).status).toBe(400);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
  it('rejects oversized files and invalid names', async () => {
    expect((await upload(new Uint8Array(2 * 1024 * 1024 + 1))).status).toBe(400);
    expect((await upload(new Uint8Array([0]), '../escape')).status).toBe(400);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
  it('serves PNGs without exposing storage credentials and rejects invalid object paths', async () => {
    storage.getObject.mockResolvedValue(Readable.from([Buffer.from('image')]));
    const response = await GET(new NextRequest(`https://meet.test/api/emojis?image=${key}`));
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('image');
    expect(
      (await GET(new NextRequest('https://meet.test/api/emojis?image=../secret'))).status,
    ).toBe(404);
  });
});
