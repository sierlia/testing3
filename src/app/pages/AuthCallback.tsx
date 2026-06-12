import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import {
  clearOAuthErrorFromLocation,
  clearOAuthReturnPath,
  clearPendingOAuthSignup,
  oauthHashRouteUrl,
  processOAuthRedirectFromLocation,
  readOAuthErrorFromLocation,
} from "../utils/oauthSignup";

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

      const session = await processOAuthRedirectFromLocation();

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
