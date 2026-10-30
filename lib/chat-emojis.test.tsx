import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatChatEmojis } from './chat-emojis';

vi.mock('next/image', () => ({
  default: ({
    unoptimized: _unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) =>
    React.createElement('img', props),
}));

describe('custom chat emojis', () => {
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
