import { emojiFromObject, type StoreEmoji } from './emoji-store';

export const STANDARD_REACTIONS = [
  { value: '👍', label: 'Thumbs up' },
  { value: '👏', label: 'Clap' },
  { value: '❤️', label: 'Heart' },
  { value: '😂', label: 'Laugh' },
  { value: '🎉', label: 'Celebrate' },
  { value: '😮', label: 'Surprised' },
];
export type ReactionEmoji = { value: string; label: string; src?: string };

export function decodeReaction(payload: Uint8Array): ReactionEmoji | undefined {
  if (payload.byteLength > 256) return;
  const text = new TextDecoder().decode(payload);
  const standard = STANDARD_REACTIONS.find((emoji) => emoji.value === text);
  if (standard) return standard;
  try {
    const data = JSON.parse(text);
    // Derive the image URL locally. Never load participant-supplied URLs.
    return typeof data?.custom === 'string' ? emojiFromObject(data.custom) : undefined;
  } catch {
    return;
  }
}

export function encodeReaction(
  value: string,
  emojis: StoreEmoji[],
): Uint8Array<ArrayBuffer> | undefined {
  if (STANDARD_REACTIONS.some((emoji) => emoji.value === value))
    return new TextEncoder().encode(value);
  const emoji = emojis.find((emoji) => emoji.value === value);
  if (!emoji) return;
  const key = new URL(emoji.src, 'https://meet.invalid').searchParams.get('image');
  const verified = key ? emojiFromObject(key) : undefined;
  if (!verified || verified.value !== value || verified.src !== emoji.src) return;
  return new TextEncoder().encode(JSON.stringify({ custom: key }));
}
