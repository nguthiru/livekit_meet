import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import '../styles/Yoonka.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Yoonka Meet — Your crew. One room.', template: '%s | Yoonka Meet' },
  description:
    'A space for your next conversation. Meet your team with video, screen sharing, live reactions and transcription.',
  openGraph: {
    title: 'Yoonka Meet — Your crew. One room.',
    description: 'Different places. Same adventure. Bring your people together with Yoonka Meet.',
    images: [
      { url: '/brand/airship.webp', width: 1600, height: 1095, alt: 'Yoonka airship and crew' },
    ],
    siteName: 'Yoonka Meet',
    type: 'website',
  },
  icons: { icon: '/brand/favicon.svg', apple: '/brand/yoonka-mark.png' },
};

export const viewport: Viewport = { themeColor: '#fffef2' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
