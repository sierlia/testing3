import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

const authQueues = new Map<string, Promise<unknown>>();

async function serializedAuthLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const previous = authQueues.get(name) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waitForPrevious = previous.catch(() => undefined);
  const queued = waitForPrevious.then(() => current);
  authQueues.set(name, queued);
  await waitForPrevious;
  try {
    return await fn();
  } finally {
    release();
    if (authQueues.get(name) === queued) authQueues.delete(name);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: serializedAuthLock,
  },
});
