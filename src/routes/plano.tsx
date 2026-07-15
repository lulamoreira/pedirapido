import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/plano")({
  beforeLoad: () => { throw redirect({ to: "/perfil" }); },
});
