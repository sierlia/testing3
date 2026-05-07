import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

let pendingUser: Promise<User | null> | null = null;

export async function getCurrentUser() {
  if (!pendingUser) {
    pendingUser = supabase.auth.getSession()
      .then(({ data }) => data.session?.user ?? null)
      .finally(() => {
        pendingUser = null;
      });
  }
  return pendingUser;
}
