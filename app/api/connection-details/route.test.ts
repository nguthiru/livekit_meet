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
});
