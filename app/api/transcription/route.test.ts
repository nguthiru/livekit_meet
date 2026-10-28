import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dispatch = vi.hoisted(() => ({
  listDispatch: vi.fn(),
  createDispatch: vi.fn(),
  deleteDispatch: vi.fn(),
}));

vi.mock('livekit-server-sdk', () => ({
  AgentDispatchClient: vi.fn(function () {
    return dispatch;
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret');
  vi.stubEnv('LIVEKIT_URL', 'wss://example.test');
  vi.stubEnv('LIVEKIT_TRANSCRIPTION_AGENT_NAME', 'custom-transcriber');
  dispatch.listDispatch.mockResolvedValue([]);
  dispatch.deleteDispatch.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

function request(method: string, roomName = 'meeting') {
  return new NextRequest(`http://localhost/api/transcription?roomName=${roomName}`, {
    method,
    ...(method !== 'GET' ? { body: JSON.stringify({ roomName }) } : {}),
  });
}

describe('transcription controls API', () => {
  it('reports a configured transcription dispatch as active, even before the agent joins', async () => {
    dispatch.listDispatch.mockResolvedValue([{ id: '1', agentName: 'custom-transcriber' }]);
    const { GET } = await import('./route');
    const response = await GET(request('GET'));
    expect(await response.json()).toEqual({ active: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('ignores unrelated agents when checking status', async () => {
    dispatch.listDispatch.mockResolvedValue([{ id: 'other', agentName: 'assistant' }]);
    const { GET } = await import('./route');
    expect(await (await GET(request('GET'))).json()).toEqual({ active: false });
  });

  it('reuses an existing dispatch when starting transcription again', async () => {
    dispatch.listDispatch.mockResolvedValue([{ id: 'existing', agentName: 'custom-transcriber' }]);
    const { POST } = await import('./route');
    const response = await POST(request('POST'));
    expect((await response.json()).dispatchId).toBe('existing');
    expect(dispatch.createDispatch).not.toHaveBeenCalled();
  });

  it('creates a dispatch using the configured agent name', async () => {
    dispatch.createDispatch.mockResolvedValue({ id: 'new', agentName: 'custom-transcriber' });
    const { POST } = await import('./route');
    expect((await POST(request('POST'))).status).toBe(200);
    expect(dispatch.createDispatch).toHaveBeenCalledWith('meeting', 'custom-transcriber', {
      metadata: JSON.stringify({ requestedBy: 'meet-frontend' }),
    });
  });

  it('stops every transcriber dispatch while preserving other agents', async () => {
    dispatch.listDispatch.mockResolvedValue([
      { id: '1', agentName: 'custom-transcriber' },
      { id: 'other', agentName: 'assistant' },
      { id: '2', agentName: 'custom-transcriber' },
    ]);
    const { DELETE } = await import('./route');
    expect(await (await DELETE(request('DELETE'))).json()).toEqual({ stopped: true });
    expect(dispatch.deleteDispatch.mock.calls).toEqual([
      ['1', 'meeting'],
      ['2', 'meeting'],
    ]);
  });

  it('rejects missing room names for every operation', async () => {
    const { GET, POST, DELETE } = await import('./route');
    for (const [method, handler] of [
      ['GET', GET],
      ['POST', POST],
      ['DELETE', DELETE],
    ] as const) {
      expect((await handler(request(method, ''))).status).toBe(400);
    }
    expect(dispatch.listDispatch).not.toHaveBeenCalled();
  });

  it('returns a recoverable error when the dispatch service fails', async () => {
    dispatch.listDispatch.mockRejectedValue(new Error('Dispatch unavailable'));
    const { GET } = await import('./route');
    const response = await GET(request('GET'));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Dispatch unavailable' });
  });
});
