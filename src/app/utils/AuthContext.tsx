import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sessionExpired: false,
  clearSessionExpired: () => {},
  signOut: async () => {},
});

const AUTH_INIT_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expectedSignOutRef = useRef(false);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let initialSessionSettled = false;

    const finishInitialSession = (nextUser: User | null) => {
      if (cancelled) return;
      setUser(nextUser);
      hadSessionRef.current = Boolean(nextUser);
      setLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      if (initialSessionSettled || cancelled) return;
      console.warn("Supabase auth session initialization timed out; continuing without an active session.");
      finishInitialSession(null);
    }, AUTH_INIT_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        initialSessionSettled = true;
        window.clearTimeout(timeoutId);
        finishInitialSession(session?.user ?? null);
      })
      .catch((error) => {
        initialSessionSettled = true;
        window.clearTimeout(timeoutId);
        console.error("Unable to initialize Supabase auth session.", error);
        finishInitialSession(null);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const isExpectedDemoSwitch =
        window.localStorage.getItem("gavel:demoAuthSwitch") === "1" ||
        (window.localStorage.getItem("gavel:demoActive") === "1" &&
          (window.localStorage.getItem("gavel:demoLaunchLoading") === "1" || Boolean(window.localStorage.getItem("gavel:demoConfettiLaunchId"))));
      if (event === "SIGNED_OUT" && isExpectedDemoSwitch) {
        return;
      }
      if (event === "SIGNED_OUT" && hadSessionRef.current && !expectedSignOutRef.current && !isExpectedDemoSwitch) {
        setSessionExpired(true);
      }
      if (session?.user) {
        setSessionExpired(false);
      }
      expectedSignOutRef.current = false;
      hadSessionRef.current = Boolean(session?.user);
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    expectedSignOutRef.current = true;
    await supabase.auth.signOut();
    window.localStorage.removeItem("gavel:demoActive");
    window.localStorage.removeItem("gavel:demoOpenedAt");
    window.localStorage.removeItem("gavel:demoLaunchId");
    window.localStorage.removeItem("gavel:demoConfettiLaunchId");
    window.localStorage.removeItem("gavel:demoCenter");
    window.localStorage.removeItem("gavel:demoLaunchOverlay");
    window.localStorage.removeItem("gavel:demoLaunchLoading");
    window.localStorage.removeItem("gavel:demoLaunchProgress");
    window.localStorage.removeItem("gavel:demoAuthSwitch");
    window.dispatchEvent(new CustomEvent("gavel:demo-ended"));
    setSessionExpired(false);
    hadSessionRef.current = false;
    setUser(null);
  };

  const clearSessionExpired = () => {
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, clearSessionExpired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
