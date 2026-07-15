import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setReady(false);
        navigate({ to: "/auth", replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);
  if (!ready) return null;
  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
