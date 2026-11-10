import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import sharp from 'sharp';
import { emojiFromObject, EMOJI_OBJECT, StoreEmoji } from '@/lib/emoji-store';
import { emojiStorage } from '@/lib/emoji-storage';

export const runtime = 'nodejs';
const MAX_FILE = 2 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    const image = request.nextUrl.searchParams.get('image');
    if (image !== null && !EMOJI_OBJECT.test(image)) {
      return NextResponse.json({ error: 'Unknown emoji' }, { status: 404 });
    }
    const { client, bucket } = emojiStorage();
    if (image) {
      const stream = await client.getObject(bucket, image);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return new NextResponse(new Uint8Array(Buffer.concat(chunks)), {
        headers: {
          'Content-Type': image.endsWith('.gif') ? 'image/gif' : 'image/png',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
    const emojis: StoreEmoji[] = [];
    for await (const object of client.listObjectsV2(bucket, '', true)) {
      const emoji = emojiFromObject(object.name ?? '');
      if (emoji) emojis.push(emoji);
    }
    emojis.sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ emojis }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if ((error as { code?: string }).code === 'NoSuchKey') {
      return NextResponse.json({ error: 'Unknown emoji' }, { status: 404 });
    }
    console.error('Emoji store read failed', error);
    return NextResponse.json({ error: 'Emoji store is unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  // Uploads require the signed, purpose-limited cookie issued by our join flow,
  // plus a participant who is still present in the room.
  try {
    const token = request.cookies.get('meet-emoji-upload')?.value;
    if (!token) throw new Error('Missing upload session');
    const claims = await new TokenVerifier(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    ).verify(token);
    if (claims.metadata !== 'emoji-upload' || !claims.sub || !claims.video?.room)
      throw new Error('Invalid upload session');
    const host = process.env.LIVEKIT_API_URL ?? process.env.LIVEKIT_URL!;
    const rooms = new RoomServiceClient(
      host.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:'),
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    await rooms.getParticipant(claims.video.room, claims.sub);
  } catch {
    return NextResponse.json(
      { error: 'Join a meeting before uploading an emoji' },
      { status: 401 },
    );
  }
  if (Number(request.headers.get('content-length')) > MAX_FILE + 65536) {
    return NextResponse.json({ error: 'Choose an image under 2 MB' }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  const file = form.get('image');
  const name = String(form.get('name') ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) {
    return NextResponse.json(
      { error: 'Use a name of 1–32 letters, numbers, dashes or underscores' },
      { status: 400 },
    );
  }
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE) {
    return NextResponse.json({ error: 'Choose an image under 2 MB' }, { status: 400 });
  }
  let image: Buffer;
  let extension: 'png' | 'gif' = 'png';
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const options = { limitInputPixels: 16_777_216 };
    const metadata = await sharp(input, options).metadata();
    if (!['png', 'jpeg', 'gif', 'webp'].includes(metadata.format ?? ''))
      throw new Error('Unsupported image');
    if (metadata.format === 'gif') {
      const frames = metadata.pages ?? 1;
      const pixels = (metadata.width ?? 0) * (metadata.pageHeight ?? metadata.height ?? 0) * frames;
      if (frames > 200 || pixels > options.limitInputPixels) throw new Error('Animation too large');
      extension = 'gif';
      image = await sharp(input, { ...options, animated: true })
        .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
        .gif({ loop: metadata.loop, delay: metadata.delay })
        .toBuffer();
    } else {
      image = await sharp(input, options)
        .rotate()
        .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    }
  } catch {
    return NextResponse.json(
      {
        error: 'Use a valid PNG, JPEG, WebP or GIF (up to 16 megapixels total and 200 GIF frames)',
      },
      { status: 400 },
    );
  }
  if (image.length > MAX_FILE) {
    return NextResponse.json(
      { error: 'Processed emoji exceeds 2 MB. Use a shorter or smaller animation.' },
      { status: 413 },
    );
  }
  try {
    const { client, bucket } = emojiStorage();
    const key = `${crypto.randomUUID()}--${name}.${extension}`;
    await client.putObject(bucket, key, image, image.length, {
      'Content-Type': `image/${extension}`,
    });
    return NextResponse.json({ emoji: emojiFromObject(key) }, { status: 201 });
  } catch (error) {
    console.error('Emoji upload failed', error);
    return NextResponse.json(
      { error: 'Could not save your emoji. Please try again.' },
      { status: 503 },
    );
  }
}
