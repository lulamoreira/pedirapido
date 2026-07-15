import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserPlus, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCliente } from "@/lib/aquaflow.functions";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function NovoClienteModal({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCliente);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [complemento, setComplemento] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  const reset = () => {
    setNome(""); setTelefone(""); setCep(""); setRua(""); setNumero("");
    setBairro(""); setCidade(""); setComplemento("");
  };

  async function handleCepBlur() {
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
    } catch { /* silencioso */ }
    finally { setCepLoading(false); }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const endereco = [
        rua && numero ? `${rua}, ${numero}` : rua || numero,
        bairro,
        cidade,
        complemento ? `Ref: ${complemento}` : "",
      ].filter(Boolean).join(" — ");
      return createFn({ data: { nome, telefone, endereco, cep: cep || undefined } });
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso! 🎉");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("DUPLICATE:")) {
        const nomeExistente = msg.split("DUPLICATE:")[1];
        toast.error(`Este telefone já está cadastrado para ${nomeExistente}`);
      } else {
        toast.error(msg || "Erro ao cadastrar cliente");
      }
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || nome.trim().length < 2) return toast.error("Informe o nome completo");
    if (telefone.replace(/\D/g, "").length < 10) return toast.error("Telefone inválido");
    if (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())
      return toast.error("Preencha o endereço completo");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md rounded-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <div className="grid h-9 w-9 place-items-center rounded-2xl gradient-primary text-primary-foreground">
              <UserPlus className="h-4 w-4" />
            </div>
            Cadastrar Novo Cliente
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-6 pb-6 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <Label className="text-xs font-bold">Nome completo *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João da Silva" className="mt-1 rounded-2xl h-11" />
          </div>
          <div>
            <Label className="text-xs font-bold">Telefone *</Label>
            <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" className="mt-1 rounded-2xl h-11" />
          </div>
          <div>
            <Label className="text-xs font-bold flex items-center gap-1">
              CEP {cepLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </Label>
            <Input value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" inputMode="numeric" className="mt-1 rounded-2xl h-11" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs font-bold">Rua *</Label>
              <Input value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Rua das Flores" className="mt-1 rounded-2xl h-11" />
            </div>
            <div>
              <Label className="text-xs font-bold">Nº *</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" className="mt-1 rounded-2xl h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-bold">Bairro *</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" className="mt-1 rounded-2xl h-11" />
            </div>
            <div>
              <Label className="text-xs font-bold">Cidade *</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo - SP" className="mt-1 rounded-2xl h-11" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Referência / Complemento
            </Label>
            <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto 12, próximo à padaria..." className="mt-1 rounded-2xl h-11" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1 rounded-2xl h-12 gradient-primary font-black">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
