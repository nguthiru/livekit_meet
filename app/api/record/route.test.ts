import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';
import { GET, POST, DELETE } from './route';
const authorize = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/host-auth', () => ({ requireHost: authorize }));

const jobs = vi.hoisted(() => ({
  listEgress: vi.fn(),
  startRoomCompositeEgress: vi.fn(),
  stopEgress: vi.fn(),
}));
vi.mock('livekit-server-sdk', async (original) => ({
  ...(await original<typeof import('livekit-server-sdk')>()),
  EgressClient: vi.fn(function () {
    return jobs;
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue(null);
  vi.stubEnv('LIVEKIT_API_URL', 'http://10.60.71.2:7880');
  vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret');
  vi.stubEnv('MINIO_ENDPOINT', '10.60.10.35:9000');
  vi.stubEnv('MINIO_SECURE', 'false');
  vi.stubEnv('MINIO_ACCESS_KEY', 'storage-key');
  vi.stubEnv('MINIO_SECRET_KEY', 'storage-secret');
  jobs.listEgress.mockResolvedValue([]);
  jobs.startRoomCompositeEgress.mockResolvedValue({ egressId: 'EG_test' });
});
afterEach(() => vi.unstubAllEnvs());
const request = (method: string, roomName = 'meeting') =>
  new NextRequest(`http://localhost/api/record?roomName=${roomName}`, {
    method,
    ...(method === 'GET' ? {} : { body: JSON.stringify({ roomName }) }),
  });
describe('recording API', () => {
  it('blocks guest start and stop requests before accessing Egress', async () => {
    authorize.mockImplementation(async () => new Response('Only hosts', { status: 403 }));
    expect((await POST(request('POST'))).status).toBe(403);
    expect((await DELETE(request('DELETE'))).status).toBe(403);
    expect(jobs.listEgress).not.toHaveBeenCalled();
    expect(jobs.startRoomCompositeEgress).not.toHaveBeenCalled();
    expect(jobs.stopEgress).not.toHaveBeenCalled();
  });
  it('sends MP4 recording to private MinIO using path style and the internal LiveKit API', async () => {
    expect((await POST(request('POST'))).status).toBe(200);
    expect(EgressClient).toHaveBeenCalledWith('http://10.60.71.2:7880', 'test-key', 'test-secret');
    const [room, output, options] = jobs.startRoomCompositeEgress.mock.calls[0];
    expect(room).toBe('meeting');
    expect(options.layout).toBe('speaker');
    expect(output.file.filepath).toMatch(/^meeting\/\d{4}-\d{2}-\d{2}T.*\.mp4$/);
    expect(output.file.output.value).toMatchObject({
      endpoint: 'http://10.60.10.35:9000',
      bucket: 'recordings',
      forcePathStyle: true,
    });
  });
  it('does not restart a recording while its upload is finishing', async () => {
    jobs.listEgress.mockResolvedValue([{ status: 2 }]);
    expect((await POST(request('POST'))).status).toBe(409);
    expect(jobs.startRoomCompositeEgress).not.toHaveBeenCalled();
    expect(await (await GET(request('GET'))).json()).toEqual({ active: true, stopping: true });
  });
  it('stops starting and active jobs, leaving finalizing and complete jobs alone', async () => {
    jobs.listEgress.mockResolvedValue(
      [0, 1, 2, 3].map((status) => ({ status, egressId: `${status}` })),
    );
    expect((await DELETE(request('DELETE'))).status).toBe(200);
    expect(jobs.stopEgress.mock.calls).toEqual([['0'], ['1']]);
  });
  it('rejects empty room names', async () => {
    for (const [method, handler] of [
      ['GET', GET],
      ['POST', POST],
      ['DELETE', DELETE],
    ] as const) {
      expect((await handler(request(method, ''))).status).toBe(400);
    }
    expect(jobs.listEgress).not.toHaveBeenCalled();
  });
});
