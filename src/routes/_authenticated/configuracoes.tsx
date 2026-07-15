import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPlano, updateDistribuidoraConfig } from "@/lib/aquaflow.functions";
import { ArrowLeft, Store, Clock, Truck, Timer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["plano"], queryFn: () => getPlano() });
  const [form, setForm] = useState({
    nome: "", telefone: "",
    horario_abertura: "08:00", horario_fechamento: "18:00",
    taxa_entrega_padrao: 0, tempo_estimado_min: 45,
  });

  useEffect(() => {
    if (data?.distribuidora) {
      const d: any = data.distribuidora;
      setForm({
        nome: d.nome ?? "",
        telefone: d.telefone ?? "",
        horario_abertura: d.horario_abertura ?? "08:00",
        horario_fechamento: d.horario_fechamento ?? "18:00",
        taxa_entrega_padrao: Number(d.taxa_entrega_padrao ?? 0),
        tempo_estimado_min: Number(d.tempo_estimado_min ?? 45),
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateDistribuidoraConfig({ data: {
      nome: form.nome, telefone: form.telefone || undefined,
      horario_abertura: form.horario_abertura, horario_fechamento: form.horario_fechamento,
      taxa_entrega_padrao: Number(form.taxa_entrega_padrao), tempo_estimado_min: Number(form.tempo_estimado_min),
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plano"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Configurações salvas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/perfil" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black">Configurações da loja</h1>
          <p className="text-xs text-muted-foreground">Horário, taxa e tempo de entrega</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-5 space-y-4">
        <Card icon={Store} title="Identidade">
          <Field label="Nome da loja*">
            <input required className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input className="input" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
          </Field>
        </Card>

        <Card icon={Clock} title="Horário de funcionamento">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Abre às"><input type="time" required className="input" value={form.horario_abertura} onChange={e => setForm({ ...form, horario_abertura: e.target.value })} /></Field>
            <Field label="Fecha às"><input type="time" required className="input" value={form.horario_fechamento} onChange={e => setForm({ ...form, horario_fechamento: e.target.value })} /></Field>
          </div>
        </Card>

        <Card icon={Truck} title="Taxa de entrega padrão">
          <Field label="Valor (R$)">
            <input type="number" step="0.01" min="0" className="input" value={form.taxa_entrega_padrao} onChange={e => setForm({ ...form, taxa_entrega_padrao: Number(e.target.value) })} />
          </Field>
        </Card>

        <Card icon={Timer} title="Tempo estimado de entrega">
          <Field label="Minutos">
            <input type="number" min="5" step="5" className="input" value={form.tempo_estimado_min} onChange={e => setForm({ ...form, tempo_estimado_min: Number(e.target.value) })} />
          </Field>
        </Card>

        <button type="submit" disabled={save.isPending} className="w-full rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float disabled:opacity-50">
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="card-float p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary"><Icon className="h-4 w-4" /></div>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
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
