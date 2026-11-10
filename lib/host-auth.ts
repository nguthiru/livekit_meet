import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export const controlCookie = (room: string) =>
  `meet-control-${createHash('sha256').update(room).digest('hex').slice(0, 20)}`;
let redis: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;
async function store() {
  if (!redis) {
    redis = createClient({
      url: process.env.LIVEKIT_REDIS_URL ?? 'redis://10.60.71.2:6379',
      password: process.env.LIVEKIT_REDIS_PASSWORD ?? process.env.LIVEKIT_API_SECRET,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    redis.on('error', (error) => console.error('Host role storage failed', error));
  }
  if (!redis.isOpen)
    connecting ??= redis.connect().finally(() => {
      connecting = undefined;
    });
  if (connecting) await connecting;
  return redis;
}

export async function hostState(request: NextRequest, roomName: string) {
  const token = request.cookies.get(controlCookie(roomName))?.value;
  if (!token) throw new Error('No meeting session');
  const claims = await new TokenVerifier(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  ).verify(token);
  if (claims.metadata !== 'meeting-control' || claims.video?.room !== roomName || !claims.sub)
    throw new Error('Invalid meeting session');
  const url = process.env.LIVEKIT_API_URL ?? process.env.LIVEKIT_URL!;
  const api = new RoomServiceClient(
    url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:'),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  );
  const [rooms, all] = await Promise.all([
    api.listRooms([roomName]),
    api.listParticipants(roomName),
  ]);
  const participants = all.filter((p) => p.kind === 0 && !p.permission?.hidden);
  if (!rooms[0]?.sid || !participants.some((p) => p.identity === claims.sub))
    throw new Error('Participant is not in the room');
  const ordered = [...participants].sort((a, b) => {
    const first = a.joinedAtMs || a.joinedAt * 1000n;
    const second = b.joinedAtMs || b.joinedAt * 1000n;
    return first === second ? a.sid.localeCompare(b.sid) : first < second ? -1 : 1;
  });
  const key = `meet:hosts:${rooms[0].sid}`;
  const db = await store();
  // Only one initializer wins, regardless of which participant polls first.
  await db.eval(
    `if redis.call('EXISTS', KEYS[1]) == 0 then redis.call('SADD', KEYS[1], ARGV[1]) end
    redis.call('EXPIRE', KEYS[1], 604800) return 1`,
    { keys: [key], arguments: [ordered[0].identity] },
  );
  const hosts = await db.sMembers(key);
  return { db, key, identity: claims.sub, hosts, participants, isHost: hosts.includes(claims.sub) };
}

export async function requireHost(request: NextRequest, roomName: string) {
  try {
    if ((await hostState(request, roomName)).isHost) return null;
  } catch (error) {
    console.warn('Host authorization denied', error);
  }
  return NextResponse.json({ error: 'Only a meeting host can use this control' }, { status: 403 });
}

export const UPDATE_HOST = `
  if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 0 then return -1 end
  if ARGV[3] == 'add' then redis.call('SADD', KEYS[1], ARGV[2]) else
    local remaining = 0
    for i = 4, #ARGV do
      if ARGV[i] ~= ARGV[2] and redis.call('SISMEMBER', KEYS[1], ARGV[i]) == 1 then remaining = remaining + 1 end
    end
    if remaining == 0 then return -2 end
    redis.call('SREM', KEYS[1], ARGV[2])
  end
  redis.call('EXPIRE', KEYS[1], 604800) return 1`;
