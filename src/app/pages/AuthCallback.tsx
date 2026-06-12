import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import {
  clearOAuthErrorFromLocation,
  clearOAuthReturnPath,
  clearPendingOAuthSignup,
  oauthHashRouteUrl,
  readOAuthErrorFromLocation,
} from "../utils/oauthSignup";

const SESSION_WAIT_ATTEMPTS = 12;
const SESSION_WAIT_MS = 250;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readCallbackSession(): Promise<Session | null> {
  for (let attempt = 0; attempt < SESSION_WAIT_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await delay(SESSION_WAIT_MS);
  }
  return null;
}

function clearCallbackUrl() {
  const url = new URL(window.location.href);
  window.history.replaceState({}, document.title, url.pathname);
}

function redirectIntoApp(path = "/") {
  window.location.replace(oauthHashRouteUrl(path));
}

export function AuthCallback() {
  const [message, setMessage] = useState("Finishing Google sign in...");

  useEffect(() => {
    let cancelled = false;

    const finishOAuth = async () => {
      const oauthError = readOAuthErrorFromLocation();
      if (oauthError) {
        clearOAuthReturnPath();
        clearPendingOAuthSignup();
        clearOAuthErrorFromLocation();
        toast.error(oauthError);
        redirectIntoApp("/signin");
        return;
      }

      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }

      const session = await readCallbackSession();
      clearCallbackUrl();

      if (!session) {
        clearOAuthReturnPath();
        clearPendingOAuthSignup();
        toast.error("Could not finish Google sign in.");
        redirectIntoApp("/signin");
        return;
      }

      if (cancelled) return;
      setMessage("Redirecting...");
      redirectIntoApp("/");
    };

    // This callback exists to let Supabase process OAuth tokens, then remove them
    // from the address bar before the hash-routed app resumes.
    finishOAuth().catch((error) => {
      clearCallbackUrl();
      clearOAuthReturnPath();
      clearPendingOAuthSignup();
      toast.error(error?.message || "Could not finish Google sign in.");
      redirectIntoApp("/signin");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Gavel className="h-5 w-5 text-blue-600" />
        {message}
      </div>
    </div>
  );
}
