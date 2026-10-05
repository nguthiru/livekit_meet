import { AgentDispatchClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_URL = process.env.LIVEKIT_API_URL ?? LIVEKIT_URL;
const TRANSCRIPTION_AGENT_NAME = process.env.LIVEKIT_TRANSCRIPTION_AGENT_NAME ?? 'transcriber';

function getHttpUrl(url: string): string {
  return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

export async function POST(request: NextRequest) {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_API_URL) {
      return NextResponse.json({ error: 'LiveKit dispatch is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const roomName = typeof body.roomName === 'string' ? body.roomName.trim() : '';
    if (!roomName) {
      return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    }

    const dispatchClient = new AgentDispatchClient(
      getHttpUrl(LIVEKIT_API_URL),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    );
    const dispatch = await dispatchClient.createDispatch(roomName, TRANSCRIPTION_AGENT_NAME, {
      metadata: JSON.stringify({ requestedBy: 'meet-frontend' }),
    });

    return NextResponse.json({
      dispatchId: dispatch.id,
      agentName: TRANSCRIPTION_AGENT_NAME,
      state: dispatch.state,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to dispatch transcription agent';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
