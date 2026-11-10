'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { StoreEmoji } from './emoji-store';
import { Icon } from './Icons';

export function useEmojiStore() {
  const [emojis, setEmojis] = useState<StoreEmoji[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/emojis', { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!signal?.aborted) {
        setEmojis(result.emojis);
        setError('');
      }
    } catch (error) {
      if (!signal?.aborted)
        setError(error instanceof Error ? error.message : 'Could not load emojis');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => void refresh(controller.signal);
    update();
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  return { emojis, error, loading, refresh };
}

export function EmojiStore({
  store,
  onChoose,
}: {
  store: ReturnType<typeof useEmojiStore>;
  onChoose: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const matches = store.emojis.filter((emoji) => emoji.label.includes(search.trim().toLowerCase()));

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/emojis', { method: 'POST', body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await store.refresh();
      form.reset();
      setAdding(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not upload emoji');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="emoji-store" aria-label="Emoji store">
      <div className="emoji-store-heading">
        <span>Emoji store</span>
        <button
          className="lk-button"
          type="button"
          aria-expanded={adding}
          onClick={() => {
            setAdding(!adding);
            setError('');
          }}
        >
          <Icon name={adding ? 'close' : 'plus'} width={16} height={16} />
          {adding ? 'Cancel' : 'Add emoji'}
        </button>
      </div>
      {adding && (
        <form className="emoji-store-upload" onSubmit={upload}>
          <label>
            Name
            <input
              name="name"
              className="lk-form-control"
              required
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9 _-]{0,31}"
              placeholder="crew-celebration"
              disabled={pending}
            />
          </label>
          <label>
            Image
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              disabled={pending}
            />
          </label>
          <p>Shared with everyone. Up to 2 MB. GIFs use their first frame.</p>
          <button className="lk-button" type="submit" disabled={pending}>
            {pending ? 'Uploading…' : 'Add to store'}
          </button>
          {error && (
            <p role="alert" className="meeting-chat-error">
              {error}
            </p>
          )}
        </form>
      )}
      <input
        className="lk-form-control"
        type="search"
        aria-label="Search custom emojis"
        placeholder="Find an emoji…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {store.error ? (
        <div className="emoji-store-status" role="status">
          {store.error}{' '}
          <button type="button" className="lk-button" onClick={() => void store.refresh()}>
            Retry
          </button>
        </div>
      ) : store.loading ? (
        <p className="emoji-store-status" role="status">
          Loading emojis…
        </p>
      ) : matches.length === 0 ? (
        <p className="emoji-store-status">
          {search
            ? 'No matching emojis.'
            : 'Your crew’s collection starts here. Add your first emoji.'}
        </p>
      ) : (
        <div className="meeting-chat-emoji-grid">
          {matches.map((emoji) => (
            <button
              className="lk-button"
              type="button"
              key={emoji.value}
              title={emoji.label}
              aria-label={emoji.label}
              onClick={() => onChoose(emoji.value)}
            >
              <Image src={emoji.src} alt="" width={28} height={28} unoptimized />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
