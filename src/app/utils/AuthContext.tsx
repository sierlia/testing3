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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expectedSignOutRef = useRef(false);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      hadSessionRef.current = Boolean(session?.user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const isExpectedDemoSwitch =
        window.localStorage.getItem("gavel:demoAuthSwitch") === "1" ||
        (window.localStorage.getItem("gavel:demoActive") === "1" &&
          (window.localStorage.getItem("gavel:demoLaunchLoading") === "1" || Boolean(window.localStorage.getItem("gavel:demoConfettiLaunchId"))));
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

    return () => subscription.unsubscribe();
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
