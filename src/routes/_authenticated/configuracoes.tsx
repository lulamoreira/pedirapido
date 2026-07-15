import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getPlano, updateDistribuidoraConfig } from "@/lib/aquaflow.functions";
import { ArrowLeft, Store, Clock, Truck, Timer, MapPin, Upload, Loader2, X, ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { maskCnpj, maskCep, validateCnpj, resizeImageToSquareDataUrl } from "@/lib/br-utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Pedirápido" }] }),
  component: ConfigPage,
});

type Form = {
  nome_fantasia: string; razao_social: string;
  telefone: string; cnpj: string;
  horario_abertura: string; horario_fechamento: string;
  taxa_entrega_padrao: number; tempo_estimado_min: number;
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string;
};

const EMPTY: Form = {
  nome_fantasia: "", razao_social: "",
  telefone: "", cnpj: "",
  horario_abertura: "08:00", horario_fechamento: "18:00",
  taxa_entrega_padrao: 0, tempo_estimado_min: 45,
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf: "",
};

function ConfigPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["plano"], queryFn: () => getPlano() });
  const [form, setForm] = useState<Form>(EMPTY);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data?.distribuidora) {
      const d = data.distribuidora as Record<string, unknown>;
      setForm({
        nome_fantasia: String(d.nome_fantasia ?? d.nome ?? ""),
        razao_social: String(d.razao_social ?? ""),
        telefone: String(d.telefone ?? ""),
        cnpj: d.cnpj ? maskCnpj(String(d.cnpj)) : "",
        horario_abertura: String(d.horario_abertura ?? "08:00"),
        horario_fechamento: String(d.horario_fechamento ?? "18:00"),
        taxa_entrega_padrao: Number(d.taxa_entrega_padrao ?? 0),
        tempo_estimado_min: Number(d.tempo_estimado_min ?? 45),
        cep: d.cep ? maskCep(String(d.cep)) : "",
        logradouro: String(d.logradouro ?? ""),
        numero: String(d.numero ?? ""),
        complemento: String(d.complemento ?? ""),
        bairro: String(d.bairro ?? ""),
        cidade: String(d.cidade ?? ""),
        uf: String(d.uf ?? ""),
      });
      setLogoDataUrl(d.logo_url ? String(d.logo_url) : null);
    }
  }, [data]);

  async function buscarCep() {
    const d = form.cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setForm((f) => ({
          ...f,
          logradouro: j.logradouro ?? f.logradouro,
          bairro: j.bairro ?? f.bairro,
          cidade: j.localidade ?? f.cidade,
          uf: j.uf ?? f.uf,
        }));
      } else {
        toast.error("CEP não encontrado");
      }
    } catch {
      toast.error("Erro ao consultar CEP");
    } finally { setCepLoading(false); }
  }

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 5MB)");
    setLogoUploading(true);
    try {
      const url = await resizeImageToSquareDataUrl(file, 256, 0.85);
      setLogoDataUrl(url);
      toast.success("Logo pronta! Salve para publicar.");
    } catch {
      toast.error("Erro ao processar imagem");
    } finally { setLogoUploading(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void processFile(f);
  }

  const save = useMutation({
    mutationFn: () => {
      if (form.cnpj && !validateCnpj(form.cnpj)) {
        throw new Error("CNPJ inválido — verifique os dígitos");
      }
      return updateDistribuidoraConfig({
        data: {
          nome_fantasia: form.nome_fantasia,
          razao_social: form.razao_social || null,
          telefone: form.telefone || undefined,
          cnpj: form.cnpj ? form.cnpj.replace(/\D/g, "") : null,
          horario_abertura: form.horario_abertura,
          horario_fechamento: form.horario_fechamento,
          taxa_entrega_padrao: Number(form.taxa_entrega_padrao),
          tempo_estimado_min: Number(form.tempo_estimado_min),
          cep: form.cep ? form.cep.replace(/\D/g, "") : null,
          logradouro: form.logradouro || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          uf: form.uf ? form.uf.toUpperCase().slice(0, 2) : null,
          logo_url: logoDataUrl,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plano"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Configurações salvas ✨");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onCnpjBlur() {
    if (!form.cnpj) return setCnpjError(null);
    setCnpjError(validateCnpj(form.cnpj) ? null : "CNPJ inválido");
  }

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/perfil" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Perfil da loja</h1>
          <p className="text-xs text-muted-foreground">Dados, endereço e logo</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-5 space-y-4">
        {/* Logo */}
        <Card icon={ImageIcon} title="Logo da distribuidora">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-4 transition ${dragActive ? "border-primary bg-primary/5" : "border-border bg-secondary/40"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f); }}
            />
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white shadow-soft overflow-hidden aspect-square">
                {logoUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : logoDataUrl ? (
                  <img src={logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Arraste ou clique</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">PNG, JPG ou WebP · será ajustada para 1:1 e otimizada</p>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLogoDataUrl(null); }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-500"
                  >
                    <X className="h-3 w-3" /> Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card icon={Store} title="Identidade">
          <Field label="Nome Fantasia *">
            <input
              required
              className="input"
              value={form.nome_fantasia}
              onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              placeholder="Como seus clientes chamam sua loja"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">Aparece no app, no cardápio e nas mensagens.</span>
          </Field>
          <Field label="Razão Social">
            <input
              className="input"
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              placeholder="Nome jurídico registrado (fiscal)"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">Exibida apenas em áreas fiscais e no rodapé do cardápio, junto ao CNPJ.</span>
          </Field>
          <Field label="Telefone / WhatsApp">
            <input className="input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="CNPJ">
            <input
              className={`input ${cnpjError ? "border-red-500" : ""}`}
              value={form.cnpj}
              onChange={(e) => { setForm({ ...form, cnpj: maskCnpj(e.target.value) }); setCnpjError(null); }}
              onBlur={onCnpjBlur}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
            {cnpjError && <p className="mt-1 text-xs font-bold text-red-500">{cnpjError}</p>}
          </Field>
        </Card>

        <Card icon={MapPin} title="Endereço físico">
          <Field label="CEP">
            <div className="relative">
              <input
                className="input pr-10"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: maskCep(e.target.value) })}
                onBlur={buscarCep}
                placeholder="00000-000"
                inputMode="numeric"
              />
              {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Logradouro">
                <input className="input" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
              </Field>
            </div>
            <Field label="Número">
              <input className="input" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </Field>
          </div>
          <Field label="Complemento">
            <input className="input" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Sala, andar, ponto de referência…" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Bairro">
                <input className="input" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </Field>
            </div>
            <Field label="UF">
              <input className="input uppercase" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <Field label="Cidade">
            <input className="input" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </Field>
        </Card>

        <Card icon={Clock} title="Horário de funcionamento">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Abre às"><input type="time" required className="input" value={form.horario_abertura} onChange={(e) => setForm({ ...form, horario_abertura: e.target.value })} /></Field>
            <Field label="Fecha às"><input type="time" required className="input" value={form.horario_fechamento} onChange={(e) => setForm({ ...form, horario_fechamento: e.target.value })} /></Field>
          </div>
        </Card>

        <Card icon={Truck} title="Taxa de entrega padrão">
          <Field label="Valor (R$)">
            <input type="number" step="0.01" min="0" className="input" value={form.taxa_entrega_padrao} onChange={(e) => setForm({ ...form, taxa_entrega_padrao: Number(e.target.value) })} />
          </Field>
        </Card>

        <Card icon={Timer} title="Tempo estimado de entrega">
          <Field label="Minutos">
            <input type="number" min="5" step="5" className="input" value={form.tempo_estimado_min} onChange={(e) => setForm({ ...form, tempo_estimado_min: Number(e.target.value) })} />
          </Field>
        </Card>

        <button type="submit" disabled={save.isPending} className="w-full rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float disabled:opacity-50">
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
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

// suppress unused import warning
void FileText;
