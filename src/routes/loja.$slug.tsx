import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { displayNomeLoja } from "@/lib/format";
import { formatProdutoLinha } from "@/lib/text-normalize";

import { maskCnpj } from "@/lib/br-utils";
import { toast } from "sonner";
import {
  ShoppingBag, Plus, Minus, Clock, MapPin, Droplet, Wine, Package as PkgIcon,
  Cookie, Sparkles, ChevronLeft, X, Loader2, CheckCircle2, Copy, Search, Moon,
} from "lucide-react";

import {
  getLojaPublica, findClientePublico, checkoutLojaPublica,
} from "@/lib/loja.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loja/$slug")({
  head: () => ({
    meta: [
      { title: "Cardápio — Pedirápido" },
      { name: "description", content: "Faça seu pedido de água online, rápido e sem cadastro. Pagamento via PIX, cartão ou dinheiro." },
      { property: "og:title", content: "Peça agora — Pedirápido" },
      { property: "og:description", content: "Cardápio digital com entrega em minutos." },
    ],
  }),
  component: LojaPage,
});

const CAT_META: Record<string, { label: string; icon: any }> = {
  agua: { label: "Água", icon: Droplet },
  bebidas: { label: "Bebidas", icon: Wine },
  descartaveis: { label: "Descartáveis", icon: PkgIcon },
  petiscos: { label: "Salgadinhos", icon: Cookie },
  outros: { label: "Outros", icon: Sparkles },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

type CartItem = { produto_id: string; nome: string; preco: number; quantidade: number };

function LojaPage() {
  const { slug } = Route.useParams();
  const slugSafe = typeof slug === "string" ? slug.trim() : "";
  const loadLoja = useServerFn(getLojaPublica);
  const { data, isLoading, error } = useQuery({
    queryKey: ["loja", slugSafe],
    queryFn: () => loadLoja({ data: { id: slugSafe } }),
    enabled: slugSafe.length > 0,
    retry: false,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [catAtiva, setCatAtiva] = useState<string>("agua");
  const [busca, setBusca] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const categorias = useMemo(() => {
    if (!data?.produtos) return [];
    const set = new Set<string>();
    data.produtos.forEach((p: any) => set.add(p.categoria));
    return Array.from(set);
  }, [data]);

  useEffect(() => {
    if (categorias.length && !categorias.includes(catAtiva)) {
      setCatAtiva(categorias[0]);
    }
  }, [categorias, catAtiva]);

  const produtosFiltrados = useMemo(() => {
    if (!data?.produtos) return [];
    const termo = busca.trim().toLowerCase();
    if (termo) {
      return data.produtos.filter((p: any) => String(p.nome ?? "").toLowerCase().includes(termo));
    }
    return data.produtos.filter((p: any) => p.categoria === catAtiva);
  }, [data, catAtiva, busca]);

  const subtotal = cart.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const qtyTotal = cart.reduce((s, i) => s + i.quantidade, 0);

  const d: any = data?.distribuidora ?? null;
  const nomeLoja = d ? displayNomeLoja(d) : "";

  useEffect(() => {
    if (nomeLoja) document.title = `${nomeLoja} — Cardápio | Pedirápido`;
  }, [nomeLoja]);

  function addToCart(p: any) {
    setCart(prev => {
      const ex = prev.find(i => i.produto_id === p.id);
      if (ex) return prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { produto_id: p.id, nome: p.nome, preco: Number(p.preco), quantidade: 1 }];
    });
  }
  function updateQty(produto_id: string, delta: number) {
    setCart(prev => prev.flatMap(i => {
      if (i.produto_id !== produto_id) return [i];
      const q = i.quantidade + delta;
      return q <= 0 ? [] : [{ ...i, quantidade: q }];
    }));
  }
  function removeItem(produto_id: string) {
    setCart(prev => prev.filter(i => i.produto_id !== produto_id));
  }

  // Loading: slug ainda não pronto OU query em andamento
  if (!slugSafe || isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] pb-24">
        <div className="mx-auto max-w-lg px-4 pt-8 pb-6 flex flex-col items-center">
          <div className="h-28 w-28 rounded-3xl bg-slate-200 animate-pulse" />
          <div className="mt-4 h-5 w-48 rounded-full bg-slate-200 animate-pulse" />
          <div className="mt-2 h-3 w-32 rounded-full bg-slate-200 animate-pulse" />
        </div>
        <div className="mx-auto max-w-lg px-4 space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-soft flex items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-3 w-1/2 rounded-full bg-slate-200 animate-pulse" />
              </div>
              <div className="h-11 w-11 rounded-2xl bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="sr-only" role="status">Carregando cardápio…</div>
      </div>
    );
  }

  if (error || !data || !d) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F7F9FC] p-6 text-center">
        <div>
          <p className="text-lg font-black">Loja não encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Verifique o link e tente novamente.</p>
          <Link to="/" className="inline-block mt-4 text-primary font-bold">Voltar</Link>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-32">
      {/* Hero com logo em destaque */}
      <section className="relative overflow-hidden gradient-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_35%)]" />
        <div className="relative mx-auto max-w-lg px-4 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="grid h-28 w-28 md:h-32 md:w-32 place-items-center rounded-3xl bg-white shadow-float overflow-hidden aspect-square ring-4 ring-white/30">
            {d.logo_url ? (
              <img src={d.logo_url} alt={nomeLoja} className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center gradient-primary text-primary-foreground">
                <Droplet className="h-10 w-10" />
              </div>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight">{nomeLoja}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold",
              d.aberto ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
            )}>
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {d.aberto ? "Aberto agora" : "Fechado"}
            </span>
            <span className="flex items-center gap-1 text-white/90">
              <Clock className="h-3 w-3" /> ~{d.tempo_estimado_min} min
            </span>
          </div>
          {(d.logradouro || d.cidade) && (
            <p className="mt-2 flex items-start gap-1 text-[11px] text-white/85 max-w-xs">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                {[
                  d.logradouro && d.numero ? `${d.logradouro}, ${d.numero}` : d.logradouro,
                  d.bairro,
                  d.cidade && d.uf ? `${d.cidade}/${d.uf}` : d.cidade,
                ].filter(Boolean).join(" · ")}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* Header sticky compacto */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-soft overflow-hidden aspect-square">
              {d.logo_url ? (
                <img src={d.logo_url} alt={nomeLoja} className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center gradient-primary text-primary-foreground">
                  <Droplet className="h-4 w-4" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-black tracking-tight">{nomeLoja}</h2>
              <span className={cn(
                "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                d.aberto ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", d.aberto ? "bg-emerald-500" : "bg-red-500")} />
                {d.aberto ? "Aberto" : "Fechado"}
              </span>
            </div>

          </div>


          {/* Categorias */}
          {categorias.length > 1 && (
            <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 pb-1">
                {categorias.map(c => {
                  const meta = CAT_META[c] ?? { label: c, icon: Sparkles };
                  const Icon = meta.icon;
                  const active = catAtiva === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCatAtiva(c)}
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition",
                        active
                          ? "gradient-primary text-primary-foreground shadow-soft"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Busca */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto…"
              className="w-full rounded-full border border-border bg-white pl-9 pr-9 py-2 text-sm outline-none focus:border-primary"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-secondary text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Banner de loja fechada */}
      {!d.aberto && (
        <div className="mx-auto max-w-lg px-4 pt-4">
          <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 p-4 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white">
              <Moon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-black text-amber-900">🌙 Fechado no momento</div>
              <p className="text-xs text-amber-800 mt-0.5">
                {d.proximoDia != null && d.proximoHorario
                  ? <>Abrimos <b>{["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][d.proximoDia]}</b> às <b>{d.proximoHorario}</b>.</>
                  : "Consulte os horários de atendimento."}
                {" "}Você pode adicionar itens e enviar como <b>pré-pedido</b> — despacharemos assim que abrirmos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Produtos */}
      <main className="mx-auto max-w-lg px-4 py-4">

        {produtosFiltrados.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-soft">
            <PkgIcon className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-bold">Sem produtos nesta categoria</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {produtosFiltrados.map((p: any) => {
              const noCart = cart.find(i => i.produto_id === p.id);
              const CatIcon = CAT_META[p.categoria]?.icon ?? Droplet;
              return (
                <li key={p.id} className="rounded-2xl bg-white p-4 shadow-soft flex items-center gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10">
                    <CatIcon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{p.nome}</p>
                    {formatProdutoLinha(p) && (
                      <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{formatProdutoLinha(p)}</p>
                    )}

                    {p.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.descricao}</p>
                    )}
                    <p className="mt-1 text-base font-black text-primary">{fmt(Number(p.preco))}</p>
                  </div>
                  {noCart ? (
                    <div className="flex items-center gap-1 rounded-full bg-primary/10 p-1">
                      <button onClick={() => updateQty(p.id, -1)} className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-soft">
                        <Minus className="h-4 w-4 text-primary" />
                      </button>
                      <span className="min-w-[20px] text-center text-sm font-black text-primary">{noCart.quantidade}</span>
                      <button onClick={() => updateQty(p.id, 1)} className="grid h-8 w-8 place-items-center rounded-full gradient-primary text-primary-foreground">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(p)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-soft"
                      aria-label="Adicionar"
                    >
                      <Plus className="h-5 w-5" />
                    </button>

                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Rodapé fiscal — Razão Social + CNPJ */}
      {(d.razao_social || d.cnpj) && (
        <footer className="mx-auto max-w-lg px-4 pt-2 pb-8 text-center text-[10px] leading-relaxed text-muted-foreground">
          {d.razao_social && <div className="font-semibold">{d.razao_social}</div>}
          {d.cnpj && <div>CNPJ: {maskCnpj(String(d.cnpj))}</div>}
        </footer>
      )}


      {/* Sticky bottom cart */}
      {qtyTotal > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-[#F7F9FC] to-transparent">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl gradient-primary px-5 py-4 text-primary-foreground shadow-soft font-black"
          >
            <span className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/25">
                <ShoppingBag className="h-4 w-4" />
              </span>
              Ver sacola · {qtyTotal} {qtyTotal === 1 ? "item" : "itens"}
            </span>
            <span>{fmt(subtotal)}</span>
          </button>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          distribuidoraId={data!.distribuidora.id}
          taxaEntrega={Number(d.taxa_entrega_padrao ?? 0)}
          cart={cart}
          isClosed={!d.aberto}
          proximoDia={d.proximoDia ?? null}
          proximoHorario={d.proximoHorario ?? null}
          onClose={() => setCheckoutOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onSuccess={() => setCart([])}
        />
      )}

    </div>
  );
}

// ---------------- Checkout ----------------

type CheckoutProps = {
  distribuidoraId: string;
  taxaEntrega: number;
  cart: CartItem[];
  isClosed: boolean;
  proximoDia: number | null;
  proximoHorario: string | null;
  onClose: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onSuccess: () => void;
};


function CheckoutModal(p: CheckoutProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [complemento, setComplemento] = useState("");
  const [referencia, setReferencia] = useState("");

  const [forma, setForma] = useState<"pix" | "cartao" | "dinheiro">("pix");
  const [troco, setTroco] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ id: string; codigo_pix: string | null; total: number; status: string } | null>(null);
  const [buscandoCli, setBuscandoCli] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const findFn = useServerFn(findClientePublico);
  const checkoutFn = useServerFn(checkoutLojaPublica);

  const subtotal = p.cart.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const total = subtotal + p.taxaEntrega;

  async function buscarCliente() {
    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 10) return;
    setBuscandoCli(true);
    try {
      const c = await findFn({ data: { distribuidora_id: p.distribuidoraId, telefone } });
      if (c) {
        setNome(c.nome ?? "");
        if (c.endereco) {
          const enderecoStr = c.endereco;
          // Formato salvo: "Rua, 123 — Bairro — Cidade — Compl: X" (ou legado "Ref: ...")
          const parts = enderecoStr.split(" — ");
          if (parts[0]) {
            const [r, n] = parts[0].split(",").map(s => s.trim());
            setRua(r ?? "");
            setNumero(n ?? "");
          }
          if (parts[1]) setBairro(parts[1]);
          if (parts[2]) setCidade(parts[2]);
        }
        if ((c as any).complemento) setComplemento((c as any).complemento);
        if (c.cep) setCep(maskCep(c.cep));
        toast.success("Bem-vindo(a) de volta! 👋");
      }

    } catch { /* ignore */ }
    finally { setBuscandoCli(false); }
  }

  async function buscarCep() {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro) {
        if (j.logradouro) setRua(j.logradouro);
        if (j.bairro) setBairro(j.bairro);
        if (j.localidade) setCidade(j.localidade + (j.uf ? ` - ${j.uf}` : ""));
      }
    } catch { /* ignore */ } finally { setCepLoading(false); }
  }

  async function finalizar() {
    if (nome.trim().length < 2) return toast.error("Informe seu nome");
    if (telefone.replace(/\D/g, "").length < 10) return toast.error("Telefone inválido");
    if (!rua || !numero || !bairro || !cidade) return toast.error("Preencha o endereço completo");
    const endereco = [
      `${rua}, ${numero}`, bairro, cidade,
      referencia ? `Ref: ${referencia}` : "",
    ].filter(Boolean).join(" — ");

    setLoading(true);
    try {
      const r = await checkoutFn({
        data: {
          distribuidora_id: p.distribuidoraId,
          cliente: {
            nome, telefone, endereco,
            cep: cep || undefined,
            complemento: complemento || undefined,
          },

          itens: p.cart.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
          forma_pagamento: forma,
          troco_para: forma === "dinheiro" && troco ? Number(troco.replace(",", ".")) : null,
          is_pre_order: p.isClosed,
        },

      });
      setResultado(r);
      setStep(4);
      p.onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar pedido");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-white">
          {step > 1 && step < 4 && (
            <button onClick={() => setStep((s) => (s - 1) as any)} className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="flex-1 text-center text-sm font-black">
            {step === 1 && "Sua sacola"}
            {step === 2 && "Identificação e entrega"}
            {step === 3 && "Pagamento"}
            {step === 4 && "Pedido enviado!"}
          </h2>
          <button onClick={p.onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-4 space-y-3 bg-[#F7F9FC]">
          {step === 1 && (
            <>
              {p.isClosed && p.cart.length > 0 && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <Moon className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <b>Estamos fora do horário de funcionamento.</b>{" "}
                    {p.proximoDia != null && p.proximoHorario ? (
                      <>Reabrimos <b>{["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][p.proximoDia]}</b> às <b>{p.proximoHorario}</b>. </>
                    ) : null}
                    Deseja confirmar seu pedido como <b>prioridade</b> assim que a loja abrir?
                  </div>
                </div>
              )}
              {p.cart.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sacola vazia</p>

              ) : (
                <>
                  <ul className="space-y-2">
                    {p.cart.map(i => (
                      <li key={i.produto_id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">{i.nome}</p>
                          <p className="text-xs text-muted-foreground">{fmt(i.preco)} un</p>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-primary/10 p-1">
                          <button onClick={() => p.onUpdateQty(i.produto_id, -1)} className="grid h-7 w-7 place-items-center rounded-full bg-white">
                            <Minus className="h-3.5 w-3.5 text-primary" />
                          </button>
                          <span className="min-w-[18px] text-center text-xs font-black text-primary">{i.quantidade}</span>
                          <button onClick={() => p.onUpdateQty(i.produto_id, 1)} className="grid h-7 w-7 place-items-center rounded-full gradient-primary text-primary-foreground">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button onClick={() => p.onRemove(i.produto_id)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-2xl bg-white p-4 shadow-soft space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-bold">{fmt(subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Taxa de entrega</span><span className="font-bold">{fmt(p.taxaEntrega)}</span></div>
                    <div className="border-t pt-2 flex justify-between text-base"><span className="font-black">Total</span><span className="font-black text-primary">{fmt(total)}</span></div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold">Telefone *</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} onBlur={buscarCliente} placeholder="(11) 99999-9999" inputMode="tel" className="rounded-2xl h-11" />
                  {buscandoCli && <div className="grid h-11 w-11 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>}
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold">Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="mt-1 rounded-2xl h-11" />
              </div>
              <div>
                <Label className="text-xs font-bold flex items-center gap-1">CEP {cepLoading && <Loader2 className="h-3 w-3 animate-spin" />}</Label>
                <Input value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onBlur={buscarCep} placeholder="00000-000" inputMode="numeric" className="mt-1 rounded-2xl h-11" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs font-bold">Rua *</Label>
                  <Input value={rua} onChange={(e) => setRua(e.target.value)} className="mt-1 rounded-2xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Nº *</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="mt-1 rounded-2xl h-11" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold">Complemento (opcional)</Label>
                <Input
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Ex: Apto 12, Bloco B, Casa fundos..."
                  className="mt-1 rounded-2xl h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-bold">Bairro *</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} className="mt-1 rounded-2xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Cidade *</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="mt-1 rounded-2xl h-11" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold flex items-center gap-1"><MapPin className="h-3 w-3" /> Ponto de referência (opcional)</Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ex: Próximo ao mercado, portão azul..."
                  className="mt-1 rounded-2xl h-11"
                />
              </div>

            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Forma de pagamento</p>
              {([
                { v: "pix", l: "PIX", d: "Pague na hora, aprovação imediata" },
                { v: "cartao", l: "Cartão na entrega", d: "Débito ou crédito com o entregador" },
                { v: "dinheiro", l: "Dinheiro", d: "Pague em espécie ao entregador" },
              ] as const).map(op => (
                <button
                  key={op.v}
                  onClick={() => setForma(op.v)}
                  className={cn(
                    "w-full rounded-2xl border-2 bg-white p-4 text-left transition",
                    forma === op.v ? "border-primary shadow-soft" : "border-transparent"
                  )}
                >
                  <p className="text-sm font-black">{op.l}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{op.d}</p>
                </button>
              ))}
              {forma === "dinheiro" && (
                <div>
                  <Label className="text-xs font-bold">Precisa de troco para quanto?</Label>
                  <Input value={troco} onChange={(e) => setTroco(e.target.value)} placeholder="Ex: 50,00" inputMode="decimal" className="mt-1 rounded-2xl h-11" />
                </div>
              )}
              <div className="rounded-2xl bg-white p-4 shadow-soft text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-black text-primary">{fmt(total)}</span></div>
              </div>
            </div>
          )}

          {step === 4 && resultado && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-black">Pedido enviado com sucesso! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">Você pode acompanhar o status abaixo</p>
              </div>
              {resultado.codigo_pix && (
                <div className="rounded-2xl bg-white p-4 shadow-soft text-left space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-primary">Pague com PIX Copia e Cola</p>
                  <p className="text-[10px] break-all font-mono bg-secondary p-2 rounded-xl">{resultado.codigo_pix}</p>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(resultado.codigo_pix!);
                      toast.success("Código PIX copiado");
                    }}
                    className="w-full rounded-2xl h-11 gradient-primary font-black"
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
                  </Button>
                </div>
              )}
              <Link
                to="/pedido/$id"
                params={{ id: resultado.id }}
                className="block rounded-2xl gradient-primary text-primary-foreground font-black h-12 leading-[3rem]"
              >
                Acompanhar pedido →
              </Link>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step < 4 && (
          <div className="p-4 border-t bg-white">
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={p.cart.length === 0} className="w-full rounded-2xl h-12 gradient-primary font-black">
                {p.isClosed ? `Confirmar pré-pedido · ${fmt(total)}` : `Continuar · ${fmt(total)}`}
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} className="w-full rounded-2xl h-12 gradient-primary font-black">
                Ir para pagamento
              </Button>
            )}
            {step === 3 && (
              <Button onClick={finalizar} disabled={loading} className="w-full rounded-2xl h-12 gradient-primary font-black">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (p.isClosed ? `Enviar pré-pedido · ${fmt(total)}` : `Finalizar pedido · ${fmt(total)}`)}
              </Button>

            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
