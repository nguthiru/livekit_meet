import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { AccessToken } from 'livekit-server-sdk';
import { NextRequest } from 'next/server';
import { controlCookie, hostState, requireHost } from './host-auth';
import { POST } from '../app/api/hosts/route';

const fixture = vi.hoisted(() => ({
  sid: 'room-instance',
  clients: [] as { destroy: () => void }[],
  members: [
    { identity: 'first', name: 'First', sid: 'PA_first', kind: 0, joinedAt: 1n, joinedAtMs: 1000n },
    {
      identity: 'second',
      name: 'Second',
      sid: 'PA_second',
      kind: 0,
      joinedAt: 2n,
      joinedAtMs: 2000n,
    },
    { identity: 'agent', name: 'Agent', sid: 'PA_agent', kind: 4, joinedAt: 0n, joinedAtMs: 0n },
  ],
}));
vi.mock('redis', async (original) => {
  const actual = await original<typeof import('redis')>();
  return {
    ...actual,
    createClient: (...args: Parameters<typeof actual.createClient>) => {
      const client = actual.createClient(...args);
      fixture.clients.push(client);
      return client;
    },
  };
});
vi.mock('livekit-server-sdk', async (original) => ({
  ...(await original<typeof import('livekit-server-sdk')>()),
  RoomServiceClient: vi.fn(function () {
    return {
      listRooms: async () => [{ sid: fixture.sid }],
      listParticipants: async () => fixture.members,
    };
  }),
}));

const binary =
  ['/opt/homebrew/bin/redis-server', '/usr/bin/redis-server'].find(existsSync) ?? 'redis-server';
const available = spawnSync(binary, ['--version']).status === 0;
let server: ChildProcess;
const secret = 'host-test-secret-at-least-32-characters';

async function request(identity: string, body?: object, tokenRoom = 'meeting') {
  const token = new AccessToken('test-key', secret, {
    identity,
    metadata: 'meeting-control',
    ttl: '1h',
  });
  token.addGrant({ room: tokenRoom });
  return new NextRequest('https://meet.test/api/hosts?roomName=meeting', {
    method: body ? 'POST' : 'GET',
    headers: { cookie: `${controlCookie('meeting')}=${await token.toJwt()}` },
    ...(body ? { body: JSON.stringify({ roomName: 'meeting', ...body }) } : {}),
  });
}

describe.skipIf(!available)('host roles against an isolated Redis server', () => {
  beforeAll(async () => {
    const reservation = createServer();
    await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    server = spawn(binary, [
      '--bind',
      '127.0.0.1',
      '--port',
      String(port),
      '--save',
      '',
      '--appendonly',
      'no',
      '--requirepass',
      secret,
    ]);
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject);
      server.on('exit', (code) => {
        if (code) reject(new Error(`Redis exited ${code}`));
      });
      server.stdout!.on('data', (data) => {
        if (data.toString().includes('Ready to accept connections')) resolve();
      });
    });
    vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
    vi.stubEnv('LIVEKIT_API_SECRET', secret);
    vi.stubEnv('LIVEKIT_API_URL', 'http://livekit.test');
    vi.stubEnv('LIVEKIT_REDIS_URL', `redis://127.0.0.1:${port}`);
  });
  beforeEach(() => {
    fixture.sid = crypto.randomUUID();
  });
  afterAll(async () => {
    for (const client of fixture.clients) client.destroy();
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM');
      await exited;
    }
    vi.unstubAllEnvs();
  });
  it('assigns the earliest human, even when a guest polls first and an agent joined earlier', async () => {
    const guest = await hostState(await request('second'), 'meeting');
    expect(guest.isHost).toBe(false);
    expect(guest.hosts).toEqual(['first']);
    expect(await requireHost(await request('first'), 'meeting')).toBeNull();
    expect((await requireHost(await request('second'), 'meeting'))?.status).toBe(403);
  });
  it('allows hosts to grant and revoke host rights, enforcing revocation on the next request', async () => {
    expect((await POST(await request('first', { identity: 'second', action: 'add' }))).status).toBe(
      200,
    );
    expect(await requireHost(await request('second'), 'meeting')).toBeNull();
    expect(
      (await POST(await request('first', { identity: 'second', action: 'remove' }))).status,
    ).toBe(200);
    expect((await requireHost(await request('second'), 'meeting'))?.status).toBe(403);
  });
  it('rejects guest promotion requests and removing the last connected host', async () => {
    expect(
      (await POST(await request('second', { identity: 'second', action: 'add' }))).status,
    ).toBe(403);
    expect(
      (await POST(await request('first', { identity: 'first', action: 'remove' }))).status,
    ).toBe(409);
  });
  it('keeps a host when concurrent hosts attempt to remove themselves', async () => {
    await POST(await request('first', { identity: 'second', action: 'add' }));
    const results = await Promise.all(
      ['first', 'second'].map(async (id) =>
        POST(await request(id, { identity: id, action: 'remove' })),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await hostState(await request('first'), 'meeting')).hosts).toHaveLength(1);
  });
  it('rejects missing sessions, cross-room tokens and identities absent from the room', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      (await requireHost(new NextRequest('https://meet.test/api/hosts'), 'meeting'))?.status,
    ).toBe(403);
    expect((await requireHost(await request('first', undefined, 'other'), 'meeting'))?.status).toBe(
      403,
    );
    expect((await requireHost(await request('outsider'), 'meeting'))?.status).toBe(403);
    vi.restoreAllMocks();
  });
  it('scopes host roles to the room SID rather than its reusable name', async () => {
    await POST(await request('first', { identity: 'second', action: 'add' }));
    fixture.sid = crypto.randomUUID();
    expect((await hostState(await request('second'), 'meeting')).isHost).toBe(false);
  });
});
