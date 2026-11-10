import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatChatEmojis } from './chat-emojis';
import { emojiFromObject } from './emoji-store';

vi.mock('next/image', () => ({
  default: ({
    unoptimized: _unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) =>
    React.createElement('img', props),
}));

describe('custom chat emojis', () => {
  it('renders uploaded GIFs directly so the browser can play the animation', () => {
    const emoji = emojiFromObject('7335dcab-472d-4aaf-baff-2bb62c2be87a--wave.gif')!;
    const html = renderToStaticMarkup(<>{formatChatEmojis(emoji.value, undefined, [emoji])}</>);
    expect(html).toContain('.gif');
    expect(html).toContain('title="wave"');
  });
  it('renders uploaded store emojis from their shortcodes for other participants', () => {
    const emoji = emojiFromObject('7335dcab-472d-4aaf-baff-2bb62c2be87a--crew.png')!;
    const html = renderToStaticMarkup(
      <>{formatChatEmojis(`Hi ${emoji.value}`, undefined, [emoji])}</>,
    );
    expect(html).toContain('src="/api/emojis?image=');
    expect(html).toContain('title="crew"');
    expect(emojiFromObject('../bad.svg')).toBeUndefined();
  });
  it('renders supported emoji shortcodes mixed with text and standard emoji', () => {
    const html = renderToStaticMarkup(
      <>{formatChatEmojis('Hi 😊 :yoonka: :yoonka_airship: :yoonka_compass:')}</>,
    );
    expect(html).toContain('Hi 😊');
    expect(html).toContain('src="/brand/favicon-32x32.png"');
    expect(html).toContain('src="/emojis/airship.svg"');
    expect(html).toContain('src="/emojis/compass.svg"');
  });

  it('preserves text formatting around custom emojis', () => {
    const format = (text: string) => <strong>{text}</strong>;
    const html = renderToStaticMarkup(<>{formatChatEmojis('Before :yoonka: after', format)}</>);
    expect(html).toContain('<strong>Before </strong>');
    expect(html).toContain('<strong> after</strong>');
  });

  it('keeps unknown shortcodes as text and escapes untrusted markup', () => {
    const html = renderToStaticMarkup(
      <>{formatChatEmojis(':unknown: <img src=x onerror=alert(1)>')}</>,
    );
    expect(html).toContain(':unknown:');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });
});
