import { RouterProvider } from "react-router";
import { useEffect, useState } from "react";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./utils/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { DemoAccountSwitcher } from "./components/DemoAccountSwitcher";

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

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <DemoAccountSwitcher />
      <AppToaster />
    </AuthProvider>
  );
}
