import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/pedido/$id/status")({
  component: () => {
    const { id } = Route.useParams();
    return <Navigate to="/pedido/$id" params={{ id }} replace />;
  },
});
