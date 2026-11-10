export type StoreEmoji = { label: string; value: string; src: string };
export const EMOJI_OBJECT = /^([0-9a-f-]{36})--([a-z0-9][a-z0-9_-]{0,31})\.png$/;

export function emojiFromObject(key: string): StoreEmoji | undefined {
  const match = EMOJI_OBJECT.exec(key);
  if (!match) return;
  return {
    label: match[2].replace(/[-_]/g, ' '),
    value: `:custom_${match[1]}:`,
    src: `/api/emojis?image=${encodeURIComponent(key)}`,
  };
}
