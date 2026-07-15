import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listEntregadores, upsertEntregador, deleteEntregador } from "@/lib/aquaflow.functions";
import { ArrowLeft, Plus, Bike, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/entregadores")({
  component: EntregadoresPage,
});

type Entregador = {
  id: string;
  nome: string;
  telefone: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  status: "disponivel" | "em_entrega" | "inativo";
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  disponivel: { label: "Disponível", cls: "bg-status-paid-bg text-status-paid" },
  em_entrega: { label: "Em entrega", cls: "bg-status-preparing-bg text-status-preparing" },
  inativo: { label: "Inativo", cls: "bg-secondary text-muted-foreground" },
};

function EntregadoresPage() {
  const qc = useQueryClient();
  const { data: lista = [] } = useQuery({ queryKey: ["entregadores"], queryFn: () => listEntregadores() });
  const [editing, setEditing] = useState<Partial<Entregador> | null>(null);

  const save = useMutation({
    mutationFn: (e: Partial<Entregador>) => upsertEntregador({ data: {
      id: e.id, nome: e.nome!, telefone: e.telefone || undefined,
      veiculo_modelo: e.veiculo_modelo || undefined, veiculo_placa: e.veiculo_placa || undefined,
      status: (e.status ?? "disponivel") as any,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entregadores"] }); setEditing(null); toast.success("Entregador salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEntregador({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entregadores"] }); toast.success("Entregador removido"); },
  });

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/perfil" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black">Equipe de Entregadores</h1>
          <p className="text-xs text-muted-foreground">Motos, placas e disponibilidade</p>
        </div>
        <button
          onClick={() => setEditing({ status: "disponivel" })}
          className="grid h-11 w-11 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-float"
          aria-label="Adicionar"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="card-float mt-6 p-6 text-center">
          <Bike className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nenhum entregador cadastrado</p>
          <p className="text-xs text-muted-foreground">Toque no + para cadastrar sua equipe</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {(lista as Entregador[]).map((e) => {
            const s = STATUS_LABELS[e.status];
            return (
              <li key={e.id} className="card-float p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent"><Bike className="h-5 w-5 text-primary" /></div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{e.nome}</div>
                        <div className="text-xs text-muted-foreground">{e.telefone || "sem telefone"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {e.veiculo_modelo && <span className="rounded-full bg-secondary px-2.5 py-1 font-medium">{e.veiculo_modelo}</span>}
                      {e.veiculo_placa && <span className="rounded-full bg-foreground px-2.5 py-1 font-mono font-bold text-background">{e.veiculo_placa}</span>}
                      <span className={"rounded-full px-2.5 py-1 font-bold " + s.cls}>{s.label}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEditing(e)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => { if (confirm("Remover este entregador?")) del.mutate(e.id); }} className="grid h-8 w-8 place-items-center rounded-full bg-destructive/10 text-destructive" aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{editing.id ? "Editar" : "Novo"} entregador</h2>
              <button onClick={() => setEditing(null)} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <form
              onSubmit={(ev) => { ev.preventDefault(); save.mutate(editing); }}
              className="space-y-3"
            >
              <Field label="Nome*"><input required value={editing.nome ?? ""} onChange={e => setEditing({ ...editing, nome: e.target.value })} className="input" /></Field>
              <Field label="Telefone"><input value={editing.telefone ?? ""} onChange={e => setEditing({ ...editing, telefone: e.target.value })} className="input" placeholder="(11) 99999-9999" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Modelo da moto"><input value={editing.veiculo_modelo ?? ""} onChange={e => setEditing({ ...editing, veiculo_modelo: e.target.value })} className="input" placeholder="Honda CG 160" /></Field>
                <Field label="Placa"><input value={editing.veiculo_placa ?? ""} onChange={e => setEditing({ ...editing, veiculo_placa: e.target.value.toUpperCase() })} className="input font-mono" placeholder="ABC-1D23" maxLength={10} /></Field>
              </div>
              <Field label="Status">
                <select value={editing.status ?? "disponivel"} onChange={e => setEditing({ ...editing, status: e.target.value as any })} className="input">
                  <option value="disponivel">Disponível</option>
                  <option value="em_entrega">Em entrega</option>
                  <option value="inativo">Inativo</option>
                </select>
              </Field>
              <button type="submit" disabled={save.isPending} className="mt-2 w-full rounded-full gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-float disabled:opacity-50">
                {save.isPending ? "Salvando…" : "Salvar entregador"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
