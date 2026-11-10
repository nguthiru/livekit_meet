import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant, TokenVerifier } from 'livekit-server-sdk';
import { controlCookie } from '../../../lib/host-auth';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const COOKIE_KEY = 'meet-browser-session';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const roomName = request.nextUrl.searchParams.get('roomName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let identity: string | undefined;
    try {
      const browserToken = request.cookies.get(COOKIE_KEY)?.value;
      if (browserToken) {
        const claims = await new TokenVerifier(API_KEY!, API_SECRET!).verify(browserToken);
        if (claims.metadata === 'meet-browser') identity = claims.sub;
      }
    } catch {
      /* Invalid browser sessions get a fresh identity. */
    }
    if (livekitServerUrl === undefined) {
      throw new Error('Invalid region');
    }

    if (typeof roomName !== 'string') {
      return new NextResponse('Missing required query parameter: roomName', { status: 400 });
    }
    if (participantName === null) {
      return new NextResponse('Missing required query parameter: participantName', { status: 400 });
    }

    // Generate participant token
    identity ??= crypto.randomUUID();
    const participantToken = await createParticipantToken(
      {
        identity,
        name: participantName,
        metadata,
      },
      roomName,
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: roomName,
      participantToken: participantToken,
      participantName: participantName,
    };
    const response = new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const uploadToken = new AccessToken(API_KEY, API_SECRET, {
      identity,
      metadata: 'emoji-upload',
      ttl: '12h',
    });
    uploadToken.addGrant({ room: roomName });
    response.cookies.set('meet-emoji-upload', await uploadToken.toJwt(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:',
      sameSite: 'strict',
      path: '/api/emojis',
      maxAge: 12 * 60 * 60,
    });
    const sessionOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:',
      sameSite: 'strict' as const,
      path: '/api',
    };
    const browserToken = new AccessToken(API_KEY, API_SECRET, {
      identity,
      metadata: 'meet-browser',
      ttl: '30d',
    });
    response.cookies.set(COOKIE_KEY, await browserToken.toJwt(), {
      ...sessionOptions,
      maxAge: 30 * 86400,
    });
    const controlToken = new AccessToken(API_KEY, API_SECRET, {
      identity,
      metadata: 'meeting-control',
      ttl: '12h',
    });
    controlToken.addGrant({ room: roomName });
    response.cookies.set(controlCookie(roomName), await controlToken.toJwt(), {
      ...sessionOptions,
      maxAge: 12 * 3600,
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(userInfo: AccessTokenOptions, roomName: string) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = '5m';
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}
