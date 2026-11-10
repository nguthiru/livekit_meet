import { describe, expect, it } from 'vitest';
import { decodeReaction, encodeReaction } from './reaction-payload';
import { emojiFromObject } from './emoji-store';

const bytes = (text: string) => new TextEncoder().encode(text);
const key = '7335dcab-472d-4aaf-baff-2bb62c2be87a--celebrate.gif';
describe('meeting reaction payloads', () => {
  it('keeps standard reactions compatible with existing clients', () => {
    expect(encodeReaction('👍', [])).toEqual(bytes('👍'));
    expect(decodeReaction(bytes('👍'))).toEqual({ value: '👍', label: 'Thumbs up' });
  });
  it('broadcasts a GIF reference that receivers can render without a cached store catalog', () => {
    const emoji = emojiFromObject(key)!;
    const payload = encodeReaction(emoji.value, [emoji])!;
    expect(payload.length).toBeLessThan(256);
    expect(decodeReaction(payload)).toEqual(emoji);
    expect(decodeReaction(payload)?.src).toContain('.gif');
  });
  it('rejects arbitrary URLs, traversal and malformed or oversized payloads', () => {
    for (const value of [
      '{broken',
      'not-a-reaction',
      JSON.stringify({ custom: '../private.png' }),
      JSON.stringify({ custom: 'https://example.test/track.gif' }),
      JSON.stringify({ src: 'https://example.test/track.gif' }),
      'a'.repeat(257),
    ])
      expect(decodeReaction(bytes(value))).toBeUndefined();
  });
  it('only sends custom reactions from the current store with canonical image URLs', () => {
    const emoji = emojiFromObject(key)!;
    expect(encodeReaction(emoji.value, [])).toBeUndefined();
    expect(
      encodeReaction(emoji.value, [{ ...emoji, src: 'https://example.test/track.gif' }]),
    ).toBeUndefined();
  });
});
