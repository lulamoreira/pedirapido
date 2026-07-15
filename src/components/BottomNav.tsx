import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardList, Package, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionUser } from "@/hooks/useSessionUser";
import { isMasterEmail } from "@/lib/isMaster";

const BASE = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSessionUser();
  const showAdmin = isMasterEmail(user?.email);
  const items = showAdmin
    ? [...BASE.slice(0, 3), { to: "/admin", label: "Admin", icon: Shield } as const, BASE[3]]
    : BASE;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          const isAdmin = to === "/admin";
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                  isAdmin && !active && "text-amber-600",
                )}
              >
                <Icon
                  className={cn("h-6 w-6 transition-transform", active && "scale-110")}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
