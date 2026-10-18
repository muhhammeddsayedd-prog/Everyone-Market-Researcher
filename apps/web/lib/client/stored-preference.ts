'use client';

import { useSyncExternalStore } from 'react';

/**
 * Small per-browser preferences (theme, sidebar) in localStorage. Reads tolerate blocked
 * storage; the server snapshot is null so markup matches until the client hydrates.
 */
const listeners = new Set<() => void>();
// Fallback when storage is blocked, so a choice still lasts for this page session.
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writePreference(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the in-memory value is used */
  }
  for (const listener of listeners) listener();
}

export function usePreference(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}
