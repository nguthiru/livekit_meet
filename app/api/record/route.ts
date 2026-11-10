import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireHost } from '../../../lib/host-auth';

function client() {
  const url = process.env.LIVEKIT_API_URL ?? process.env.LIVEKIT_URL;
  if (!url || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    throw new Error('Recording is not configured');
  }
  return new EgressClient(
    url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:'),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  );
}

export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get('roomName')?.trim();
    if (!roomName) return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    const jobs = await client().listEgress({ roomName });
    return NextResponse.json(
      {
        active: jobs.some((job) => job.status < 3),
        stopping: jobs.some((job) => job.status === 2),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roomName = typeof body.roomName === 'string' ? body.roomName.trim() : '';
    if (!roomName) return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    const denied = await requireHost(request, roomName);
    if (denied) return denied;
    const egress = client();
    const jobs = await egress.listEgress({ roomName });
    if (jobs.some((job) => job.status < 3)) {
      return NextResponse.json(
        { error: 'Recording is already active or finishing' },
        { status: 409 },
      );
    }
    const { MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY } = process.env;
    if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
      throw new Error('Recording storage is not configured');
    }
    const endpoint = /^https?:\/\//.test(MINIO_ENDPOINT)
      ? MINIO_ENDPOINT
      : `${process.env.MINIO_SECURE === 'false' ? 'http' : 'https'}://${MINIO_ENDPOINT}`;
    const filepath = `${encodeURIComponent(roomName)}/${new Date().toISOString().replace(/:/g, '-')}-${crypto.randomUUID()}.mp4`;
    const job = await egress.startRoomCompositeEgress(
      roomName,
      {
        file: new EncodedFileOutput({
          fileType: EncodedFileType.MP4,
          filepath,
          output: {
            case: 's3',
            value: new S3Upload({
              endpoint,
              accessKey: MINIO_ACCESS_KEY,
              secret: MINIO_SECRET_KEY,
              bucket: process.env.MINIO_RECORDING_BUCKET ?? 'recordings',
              region: process.env.MINIO_REGION ?? 'us-east-1',
              forcePathStyle: true,
            }),
          },
        }),
      },
      { layout: 'speaker' },
    );
    return NextResponse.json({ egressId: job.egressId });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const roomName = typeof body.roomName === 'string' ? body.roomName.trim() : '';
    if (!roomName) return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    const denied = await requireHost(request, roomName);
    if (denied) return denied;
    const egress = client();
    const jobs = await egress.listEgress({ roomName });
    await Promise.all(
      jobs.filter((job) => job.status < 2).map((job) => egress.stopEgress(job.egressId)),
    );
    return NextResponse.json({ stopped: true });
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  console.error('Recording request failed', error);
  return NextResponse.json(
    { error: 'Recording request failed; check the Meet and Egress logs' },
    { status: 502 },
  );
}
