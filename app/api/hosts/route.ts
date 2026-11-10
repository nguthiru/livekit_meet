import { NextRequest, NextResponse } from 'next/server';
import { hostState, UPDATE_HOST } from '../../../lib/host-auth';

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get('roomName')?.trim();
  if (!room) return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
  try {
    const state = await hostState(request, room);
    return NextResponse.json(
      {
        isHost: state.isHost,
        participants: state.participants.map((p) => ({
          identity: p.identity,
          name: p.name || p.identity,
          isHost: state.hosts.includes(p.identity),
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to verify meeting roles. Rejoin the meeting and retry.' },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { roomName, identity, action } = await request.json();
    if (
      typeof roomName !== 'string' ||
      typeof identity !== 'string' ||
      !['add', 'remove'].includes(action)
    )
      return NextResponse.json({ error: 'Invalid role change' }, { status: 400 });
    const state = await hostState(request, roomName);
    if (!state.isHost)
      return NextResponse.json({ error: 'Only hosts can manage hosts' }, { status: 403 });
    if (action === 'add' && !state.participants.some((p) => p.identity === identity))
      return NextResponse.json(
        { error: 'Participant is no longer in the meeting' },
        { status: 409 },
      );
    const result = await state.db.eval(UPDATE_HOST, {
      keys: [state.key],
      arguments: [state.identity, identity, action, ...state.participants.map((p) => p.identity)],
    });
    if (result === -1)
      return NextResponse.json({ error: 'Host permission was removed' }, { status: 403 });
    if (result === -2)
      return NextResponse.json({ error: 'Keep at least one host in the meeting' }, { status: 409 });
    return NextResponse.json({ updated: true });
  } catch {
    return NextResponse.json({ error: 'Unable to change host roles' }, { status: 403 });
  }
}
