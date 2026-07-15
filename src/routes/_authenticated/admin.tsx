import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminData } from "@/lib/admin.functions";
import { formatBRL } from "@/lib/format";
import { ArrowLeft, Building2, TrendingUp, DollarSign, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin"], queryFn: () => getAdminData() });

  if (error) return (
    <div className="p-6">
      <Link to="/dashboard" className="text-sm text-primary">← Voltar</Link>
      <div className="card-float mt-4 p-6 text-center">
        <h1 className="text-lg font-bold">Área restrita</h1>
        <p className="mt-2 text-sm text-muted-foreground">Apenas administradores master.</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black">Admin Master</h1>
          <p className="text-xs text-muted-foreground">Visão geral do SaaS</p>
        </div>
      </div>

      {isLoading && <div className="mt-6 text-sm text-muted-foreground">Carregando…</div>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Kpi icon={DollarSign} label="MRR" value={formatBRL(data.mrr)} />
            <Kpi icon={TrendingUp} label="GMV total" value={formatBRL(data.gmv)} />
            <Kpi icon={Building2} label="Distribuidoras" value={String(data.totalDistribuidoras)} />
            <Kpi icon={Package} label="Pedidos totais" value={String(data.totalPedidos)} />
          </div>

          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Distribuidoras</h2>
          <div className="mt-2 space-y-2">
            {data.distribuidoras.map((d) => (
              <div key={d.id} className="card-float p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{d.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <span className={
                    "rounded-full px-3 py-1 text-[10px] font-bold uppercase " +
                    (d.plano === "pro" ? "bg-primary text-primary-foreground" :
                     d.plano === "business" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")
                  }>
                    {d.plano}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="card-float p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-xl font-black tracking-tight">{value}</div>
    </div>
  );
}
