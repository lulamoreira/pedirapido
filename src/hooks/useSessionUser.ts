import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SessionUser = { id: string; email: string | null } | null;

/** Reactive current session user (client-only). */
export function useSessionUser() {
  const [user, setUser] = useState<SessionUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session ? { id: data.session.user.id, email: data.session.user.email ?? null } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session ? { id: session.user.id, email: session.user.email ?? null } : null);
      setLoading(false);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return { user, loading };
}
