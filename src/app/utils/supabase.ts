import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const missingSupabaseMessage = "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use sign-in, demo accounts, and app data.";

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

function missingSupabaseError() {
  return new Error(missingSupabaseMessage);
}

function disabledQueryResult() {
  return {
    data: null,
    error: missingSupabaseError(),
    count: null,
    status: 0,
    statusText: "Supabase not configured",
  };
}

function createDisabledQueryBuilder() {
  const result = disabledQueryResult();
  const builder = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return Promise.resolve(result).then.bind(Promise.resolve(result));
        }
        if (prop === "catch") {
          return Promise.resolve(result).catch.bind(Promise.resolve(result));
        }
        if (prop === "finally") {
          return Promise.resolve(result).finally.bind(Promise.resolve(result));
        }
        return () => builder;
      },
    },
  );
  return builder;
}

function createDisabledSupabaseClient(): SupabaseClient {
  const authSubscription = { data: { subscription: { unsubscribe: () => {} } } };
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => authSubscription,
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: missingSupabaseError() }),
    signUp: async () => ({ data: { user: null, session: null }, error: missingSupabaseError() }),
  };
  const storageBucket = {
    upload: async () => ({ data: null, error: missingSupabaseError() }),
    download: async () => ({ data: null, error: missingSupabaseError() }),
    createSignedUrl: async () => ({ data: null, error: missingSupabaseError() }),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
  };
  const client = {
    auth,
    from: () => createDisabledQueryBuilder(),
    rpc: () => createDisabledQueryBuilder(),
    storage: {
      from: () => storageBucket,
    },
  };
  return client as unknown as SupabaseClient;
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: serializedAuthLock,
  },
}) : createDisabledSupabaseClient();
