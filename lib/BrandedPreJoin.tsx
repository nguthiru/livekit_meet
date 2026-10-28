'use client';
import { PreJoin, type PreJoinProps } from '@livekit/components-react';
import { useEffect, useRef } from 'react';

export function BrandedPreJoin(props: PreJoinProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const labelControls = () => {
      root.querySelectorAll<HTMLButtonElement>('button[data-lk-source]').forEach((button) => {
        const label =
          button.dataset.lkSource === 'microphone' ? 'Toggle microphone' : 'Toggle camera';
        button.setAttribute('aria-label', label);
        button.title = label;
      });
      root.querySelectorAll<HTMLButtonElement>('.lk-button-menu').forEach((button, index) => {
        button.setAttribute('aria-label', index === 0 ? 'Choose microphone' : 'Choose camera');
        button.title = index === 0 ? 'Choose microphone' : 'Choose camera';
      });
      const join = root.querySelector<HTMLButtonElement>('.lk-join-button');
      if (join) {
        join.setAttribute('aria-label', 'Join meeting');
        join.title = 'Join meeting';
      }
      root.querySelector('input[name="username"]')?.setAttribute('aria-label', 'Your name');
    };
    labelControls();
    const observer = new MutationObserver(labelControls);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref}>
      <PreJoin
        {...props}
        joinLabel="Join meeting"
        micLabel="Microphone"
        camLabel="Camera"
        userLabel="Your name"
      />
    </div>
  );
}
