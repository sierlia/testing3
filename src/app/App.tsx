import { RouterProvider } from "react-router";
import { useEffect, useState } from "react";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./utils/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { DemoAccountSwitcher } from "./components/DemoAccountSwitcher";
import { Gavel } from "lucide-react";

const publicRoutes = ["/", "/signin", "/signup", "/about"];

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

  useEffect(() => {
    const update = () => setHash(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const path = currentHashPath();
  const isPublic = isPublicPath(path);
  const demoAuthSwitching = window.localStorage.getItem("gavel:demoAuthSwitch") === "1";

  useEffect(() => {
    if (loading || user || isPublic || demoAuthSwitching) return;
    const target = hash.startsWith("/") ? hash : `/${hash}`;
    window.location.hash = `/signin?redirect=${encodeURIComponent(target)}`;
  }, [demoAuthSwitching, hash, isPublic, loading, user]);

  if (loading || demoAuthSwitching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gavel className="h-5 w-5 text-blue-600" />
          {demoAuthSwitching ? "Switching demo user..." : "Loading..."}
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
