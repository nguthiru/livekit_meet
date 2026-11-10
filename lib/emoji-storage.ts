import { Client } from 'minio';

export function emojiStorage() {
  const { MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY } = process.env;
  if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
    throw new Error('Emoji storage is not configured');
  }
  const url = new URL(
    /^https?:\/\//.test(MINIO_ENDPOINT)
      ? MINIO_ENDPOINT
      : `${process.env.MINIO_SECURE === 'false' ? 'http' : 'https'}://${MINIO_ENDPOINT}`,
  );
  return {
    bucket: process.env.MINIO_EMOJI_BUCKET ?? 'livekit-emojis',
    client: new Client({
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
      region: process.env.MINIO_REGION ?? 'us-east-1',
    }),
  };
}
