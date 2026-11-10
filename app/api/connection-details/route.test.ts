import { afterEach, expect, it, vi } from 'vitest';
import { TokenVerifier } from 'livekit-server-sdk';
import { NextRequest } from 'next/server';

vi.mock('@/lib/client-utils', () => ({ randomString: () => 'test' }));
vi.mock('@/lib/getLiveKitURL', () => ({ getLiveKitURL: (url: string) => url }));

afterEach(() => vi.unstubAllEnvs());

it('allows meeting participants to update their own hand state without room admin access', async () => {
  vi.resetModules();
  const secret = 'test-only-api-secret-with-at-least-32-characters';
  vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
  vi.stubEnv('LIVEKIT_API_SECRET', secret);
  vi.stubEnv('LIVEKIT_URL', 'wss://example.test');
  const { GET } = await import('./route');
  const response = await GET(
    new NextRequest(
      'http://localhost/api/connection-details?roomName=team-meeting&participantName=Anya',
    ),
  );
  expect(response?.status).toBe(200);
  const details = await response!.json();
  const claims = await new TokenVerifier('test-key', secret).verify(details.participantToken);
  expect(claims.video?.canUpdateOwnMetadata).toBe(true);
  expect(claims.video?.room).toBe('team-meeting');
  expect(claims.video?.roomAdmin).not.toBe(true);
  const upload = response!.cookies.get('meet-emoji-upload');
  expect(upload).toBeDefined();
  const uploadClaims = await new TokenVerifier('test-key', secret).verify(upload!.value);
  expect(uploadClaims.metadata).toBe('emoji-upload');
  expect(uploadClaims.video?.roomJoin).not.toBe(true);
  expect(uploadClaims.video?.room).toBe('team-meeting');
  const session = response!.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith('meet-control-'))!;
  const sessionClaims = await new TokenVerifier('test-key', secret).verify(session.value);
  expect(sessionClaims.metadata).toBe('meeting-control');
  expect(sessionClaims.sub).toBe(claims.sub);
  expect(sessionClaims.video?.room).toBe('team-meeting');
  expect(sessionClaims.video?.roomJoin).not.toBe(true);
  expect(sessionClaims.video?.roomAdmin).not.toBe(true);

  // Names and the old editable postfix cannot be used to impersonate a host.
  const guestResponse = await GET(
    new NextRequest(
      'http://localhost/api/connection-details?roomName=team-meeting&participantName=Anya',
      { headers: { cookie: 'random-participant-postfix=test; meet-browser-session=forged' } },
    ),
  );
  const guest = await guestResponse!.json();
  const guestClaims = await new TokenVerifier('test-key', secret).verify(guest.participantToken);
  expect(guestClaims.sub).not.toBe(claims.sub);

  const browserSession = response!.cookies.get('meet-browser-session')!;
  const rejoinResponse = await GET(
    new NextRequest(
      'http://localhost/api/connection-details?roomName=team-meeting&participantName=NewName',
      { headers: { cookie: `meet-browser-session=${browserSession.value}` } },
    ),
  );
  const rejoin = await rejoinResponse!.json();
  const rejoinClaims = await new TokenVerifier('test-key', secret).verify(rejoin.participantToken);
  expect(rejoinClaims.sub).toBe(claims.sub);
});
