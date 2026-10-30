import React, { Fragment } from 'react';
import Image from 'next/image';
import type { MessageFormatter } from '@livekit/components-react';

export const CUSTOM_CHAT_EMOJIS = [
  { label: 'Yoonka', value: ':yoonka:', src: '/brand/favicon-32x32.png' },
  { label: 'Airship', value: ':yoonka_airship:', src: '/emojis/airship.svg' },
  { label: 'Compass', value: ':yoonka_compass:', src: '/emojis/compass.svg' },
];

export const CHAT_EMOJIS = [
  { label: 'Smile', value: '😊' },
  { label: 'Laugh', value: '😂' },
  { label: 'Heart', value: '❤️' },
  { label: 'Thumbs up', value: '👍' },
  { label: 'Clap', value: '👏' },
  { label: 'Celebrate', value: '🎉' },
  { label: 'Wave', value: '👋' },
  { label: 'Thank you', value: '🙏' },
  { label: 'Thinking', value: '🤔' },
  { label: 'Surprised', value: '😮' },
  { label: 'Eyes', value: '👀' },
  { label: 'Check', value: '✅' },
  { label: 'Fire', value: '🔥' },
  { label: 'Rocket', value: '🚀' },
  { label: 'Coffee', value: '☕' },
  { label: 'Handshake', value: '🤝' },
];

export function formatChatEmojis(message: string, formatter?: MessageFormatter) {
  return message.split(/(:yoonka:|:yoonka_airship:|:yoonka_compass:)/g).map((part, index) => {
    const emoji = CUSTOM_CHAT_EMOJIS.find((emoji) => emoji.value === part);
    return emoji ? (
      <Image
        key={index}
        className="meeting-chat-custom-emoji"
        src={emoji.src}
        alt={emoji.value}
        title={emoji.label}
        width={24}
        height={24}
        unoptimized
      />
    ) : (
      <Fragment key={index}>{formatter ? formatter(part) : part}</Fragment>
    );
  });
}
