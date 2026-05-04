import { supabase } from "./supabase";

export type DemoAccountKey = "student1" | "student2" | "teacher1" | "teacher2";

export const demoAccounts: Array<{ key: DemoAccountKey; label: string }> = [
  { key: "teacher1", label: "Teacher 1" },
  { key: "teacher2", label: "Teacher 2" },
  { key: "student1", label: "Student 1" },
  { key: "student2", label: "Student 2" },
];

export async function switchDemoAccount(key: DemoAccountKey) {
  const { data, error } = await supabase.rpc("demo_account_credentials", { account_key: key });
  if (error) throw error;
  const credentials = Array.isArray(data) ? data[0] : data;
  if (!credentials?.email || !credentials?.password) throw new Error("Demo account is not configured.");

  window.localStorage.setItem("gavel:demoActive", "1");
  window.localStorage.setItem("gavel:demoOpenedAt", String(Date.now()));
  window.dispatchEvent(new CustomEvent("gavel:demo-opened"));
  await supabase.auth.signOut();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (signInError) throw signInError;

  const target = credentials.role === "teacher"
    ? `/teacher/class/${credentials.class_id}`
    : `/class/${credentials.class_id}/dashboard`;
  window.location.hash = target;
}
