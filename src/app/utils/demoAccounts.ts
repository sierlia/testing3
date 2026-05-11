import { supabase } from "./supabase";

export type DemoAccountKey = "student1" | "student2" | "teacher1" | "teacher2";

export const demoAccounts: Array<{ key: DemoAccountKey; label: string }> = [
  { key: "teacher1", label: "Teacher 1" },
  { key: "teacher2", label: "Teacher 2" },
  { key: "student1", label: "Student 1" },
  { key: "student2", label: "Student 2" },
];

function currentRoutePath() {
  const hashPath = window.location.hash.replace(/^#/, "");
  if (hashPath && hashPath !== "/") return hashPath;
  return window.location.pathname || "/";
}

function setDemoLaunchProgress(progress: number) {
  window.localStorage.setItem("gavel:demoLaunchProgress", String(progress));
  window.dispatchEvent(new CustomEvent("gavel:demo-launch-progress", { detail: { progress } }));
}

export async function switchDemoAccount(key: DemoAccountKey, options?: { confetti?: boolean; preserveLocation?: boolean }) {
  const currentPath = currentRoutePath();
  const launchDemo = Boolean(options?.confetti);
  const launchId = launchDemo ? `${Date.now()}:${Math.random().toString(36).slice(2)}` : "";

  window.localStorage.setItem("gavel:demoActive", "1");
  window.localStorage.setItem("gavel:demoAuthSwitch", "1");
  window.dispatchEvent(new CustomEvent("gavel:demo-auth-switch-start"));
  if (launchDemo) {
    window.localStorage.setItem("gavel:demoOpenedAt", String(Date.now()));
    window.localStorage.setItem("gavel:demoLaunchId", launchId);
    window.localStorage.setItem("gavel:demoConfettiLaunchId", launchId);
    window.localStorage.setItem("gavel:demoCenter", "1");
    window.localStorage.setItem("gavel:demoLaunchOverlay", "1");
    window.localStorage.setItem("gavel:demoLaunchLoading", "1");
    setDemoLaunchProgress(5);
    window.dispatchEvent(new CustomEvent("gavel:demo-launch-start"));
  }

  try {
    const { data, error } = await supabase.rpc("demo_account_credentials", { account_key: key });
    if (error) throw error;
    const credentials = Array.isArray(data) ? data[0] : data;
    if (!credentials?.email || !credentials?.password) throw new Error("Demo account is not configured.");
    if (launchDemo) setDemoLaunchProgress(25);

    await supabase.auth.signOut();
    if (launchDemo) setDemoLaunchProgress(40);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (signInError) throw signInError;
    window.localStorage.removeItem("gavel:demoAuthSwitch");
    if (launchDemo) setDemoLaunchProgress(65);

    const defaultTarget = "/dashboard";
    const isPublicRoute = ["/", "/signin", "/signup", "/about"].includes(currentPath);
    const studentDashboardOnlyRoute = currentPath === "/classes" || currentPath.startsWith("/classes?");
    const incompatibleRoleRoute =
      (credentials.role === "student" && (currentPath.startsWith("/teacher/") || studentDashboardOnlyRoute)) ||
      (credentials.role === "teacher" && currentPath.startsWith("/class/"));
    const target = options?.preserveLocation && !isPublicRoute && !incompatibleRoleRoute ? currentPath : defaultTarget;
    window.location.hash = target;
    if (launchDemo) setDemoLaunchProgress(80);
    window.dispatchEvent(new CustomEvent("gavel:demo-opened"));
  } catch (error) {
    window.localStorage.removeItem("gavel:demoAuthSwitch");
    if (launchDemo) {
      window.localStorage.removeItem("gavel:demoActive");
      window.localStorage.removeItem("gavel:demoOpenedAt");
      window.localStorage.removeItem("gavel:demoLaunchId");
      window.localStorage.removeItem("gavel:demoConfettiLaunchId");
      window.localStorage.removeItem("gavel:demoCenter");
      window.localStorage.removeItem("gavel:demoLaunchOverlay");
      window.localStorage.removeItem("gavel:demoLaunchLoading");
      window.localStorage.removeItem("gavel:demoLaunchProgress");
      window.dispatchEvent(new CustomEvent("gavel:demo-launch-cancel"));
    }
    throw error;
  }
}
