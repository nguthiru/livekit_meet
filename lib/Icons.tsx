import { SVGProps } from 'react';

export type IconName =
  | 'video'
  | 'arrow'
  | 'plus'
  | 'link'
  | 'settings'
  | 'back'
  | 'smile'
  | 'transcript'
  | 'stop'
  | 'loader'
  | 'check'
  | 'shield'
  | 'users'
  | 'close'
  | 'server'
  | 'copy'
  | 'mic';
const paths: Record<IconName, React.ReactNode> = {
  video: (
    <>
      <rect x="3" y="5" width="12" height="14" rx="3" />
      <path d="m15 10 6-4v12l-6-4" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  link: (
    <>
      <path
        d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
        transform="translate(1 0)"
      />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z" />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01" />
    </>
  ),
  transcript: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8m-8 4h8m-8 4h4" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  loader: <path d="M21 12a9 9 0 1 1-9-9" />,
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  server: (
    <>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 6.5h.01M7 17.5h.01M16 6.5h2M16 17.5h2" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
    </>
  ),
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
