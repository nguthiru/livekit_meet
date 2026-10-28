import { RefObject, useEffect, useState } from 'react';

export function useConferenceControlBar(conferenceRef: RefObject<HTMLDivElement | null>) {
  const [controlBar, setControlBar] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const conference = conferenceRef.current;
    if (!conference) return;
    const update = () => setControlBar(conference.querySelector<HTMLElement>('.lk-control-bar'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(conference, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [conferenceRef]);

  return controlBar;
}
