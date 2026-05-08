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
  const { user, loading } = useAuth();
  const [hash, setHash] = useState(window.location.hash.replace(/^#/, "") || "/");

  useEffect(() => {
    const update = () => setHash(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const path = currentHashPath();
  const isPublic = isPublicPath(path);

  useEffect(() => {
    if (loading || user || isPublic) return;
    const target = hash.startsWith("/") ? hash : `/${hash}`;
    window.location.hash = `/signin?redirect=${encodeURIComponent(target)}`;
  }, [hash, isPublic, loading, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gavel className="h-5 w-5 text-blue-600" />
          Loading...
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
