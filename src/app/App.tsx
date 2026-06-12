import { RouterProvider } from "react-router";
import { useEffect, useState } from "react";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./utils/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { DemoAccountSwitcher } from "./components/DemoAccountSwitcher";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import {
  clearOAuthErrorFromLocation,
  clearOAuthReturnPath,
  clearPendingOAuthSignup,
  completePendingOAuthSignup,
  consumeOAuthReturnPath,
  getPendingOAuthSignup,
  readOAuthErrorFromLocation,
} from "./utils/oauthSignup";

const publicRoutes = ["/", "/signin", "/signup", "/about", "/help", "/privacy", "/terms", "/cookies", "/ferpa-coppa"];

function currentHashPath() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  return hash.split("?")[0] || "/";
}

function isPublicPath(path: string) {
  return publicRoutes.includes(path);
}

function AppToaster() {
  const { user } = useAuth();
  const [hashPath, setHashPath] = useState(window.location.hash.replace(/^#/, ""));
  useEffect(() => {
    const update = () => setHashPath(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const isTeacher = (user?.user_metadata as any)?.role === "teacher";
  const isSimulationSettings = hashPath.startsWith("/teacher/setup") || hashPath.includes("/settings") || hashPath.startsWith("/teacher/simulation-settings");
  return <Toaster position="bottom-right" offset={isTeacher && isSimulationSettings ? "96px" : "24px"} />;
}

function AppRouterGate() {
  const { user, loading, sessionExpired, clearSessionExpired } = useAuth();
  const [hash, setHash] = useState(window.location.hash.replace(/^#/, "") || "/");
  const [demoAuthSwitching, setDemoAuthSwitching] = useState(() => window.localStorage.getItem("gavel:demoAuthSwitch") === "1");
  const [oauthCompleting, setOauthCompleting] = useState(false);

  useEffect(() => {
    const update = () => setHash(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  useEffect(() => {
    const update = () => setDemoAuthSwitching(window.localStorage.getItem("gavel:demoAuthSwitch") === "1");
    window.addEventListener("storage", update);
    window.addEventListener("gavel:demo-auth-switch-start", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("gavel:demo-auth-switch-start", update);
    };
  }, []);

  const path = currentHashPath();
  const isPublic = isPublicPath(path);

  useEffect(() => {
    const oauthError = readOAuthErrorFromLocation();
    if (!oauthError) return;
    clearOAuthReturnPath();
    clearPendingOAuthSignup();
    clearOAuthErrorFromLocation();
    toast.error(oauthError);
  }, []);

  useEffect(() => {
    if (loading || !user || oauthCompleting || !getPendingOAuthSignup()) return;
    let cancelled = false;
    setOauthCompleting(true);
    completePendingOAuthSignup(user)
      .then((completed) => {
        if (cancelled || !completed) return;
        clearOAuthReturnPath();
        toast.success("Google sign up completed.");
        window.location.hash = completed.redirectPath;
      })
      .catch((error) => {
        clearOAuthReturnPath();
        clearPendingOAuthSignup();
        toast.error(error?.message || "Could not finish Google sign up");
      })
      .finally(() => {
        if (!cancelled) setOauthCompleting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, oauthCompleting, user]);

  useEffect(() => {
    if (loading || !user || oauthCompleting || getPendingOAuthSignup()) return;
    const returnPath = consumeOAuthReturnPath();
    if (returnPath && currentHashPath() !== returnPath) window.location.hash = returnPath;
  }, [loading, oauthCompleting, user]);

  useEffect(() => {
    if (loading || user || isPublic || demoAuthSwitching) return;
    const target = hash.startsWith("/") ? hash : `/${hash}`;
    window.location.hash = `/signin?redirect=${encodeURIComponent(target)}`;
  }, [demoAuthSwitching, hash, isPublic, loading, user]);

  if (loading || oauthCompleting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gavel className="h-5 w-5 text-blue-600" />
          {oauthCompleting ? "Finishing sign up..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-200 p-4">
        <div className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-6 text-center shadow-sm">
          <Gavel className="mx-auto mb-3 h-8 w-8 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">Session ended</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your session is no longer authenticated. This can happen if you sign in on another device, your session expires, or the server revokes the login.
          </p>
          <button
            type="button"
            onClick={() => {
              clearSessionExpired();
              window.location.hash = `/signin?redirect=${encodeURIComponent(hash.startsWith("/") ? hash : `/${hash}`)}`;
            }}
            className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isPublic) {
    if (demoAuthSwitching) {
      return <div className="min-h-screen bg-gray-50" />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <Gavel className="mx-auto mb-3 h-8 w-8 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">Sign in required</h1>
          <p className="mt-2 text-sm text-gray-600">You need to sign in before opening this page.</p>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouterGate />
      <DemoAccountSwitcher />
      <AppToaster />
    </AuthProvider>
  );
}
