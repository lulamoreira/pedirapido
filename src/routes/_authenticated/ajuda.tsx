import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — Pedirápido" },
      { name: "description", content: "Manual completo do Pedirápido: cardápio digital, PDV, CRM, entregadores, pré-pedidos e mais." },
    ],
  }),
  component: AjudaPage,
});

type Categoria = {
  value: string;
  emoji: string;
  titulo: string;
  badge?: string;
  content: React.ReactNode;
};

const CATEGORIAS: Categoria[] = [
  {
    value: "cardapio",
    emoji: "🌐",
    titulo: "Seu cardápio digital (link comercial)",
    badge: "Vendas online",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">O que é:</span> É a sua página pública de vendas que
          você coloca na bio do Instagram ou envia no WhatsApp para os clientes pedirem direto pelo navegador.
        </p>
        <p>
          <span className="font-semibold text-foreground">Como funciona:</span> No topo da sua página inicial,
          existe um card com o seu link comercial amigável (ex:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
            pedirapido.com.br/loja/sua-loja
          </code>
          ). Você pode clicar nele para ver o seu cardápio, ou clicar no botão{" "}
          <span className="font-medium text-foreground">"Copiar"</span> para enviar o link direto para seus clientes.
        </p>
        <p>
          <span className="font-semibold text-foreground">Regra de Plano:</span> Se você estiver no plano{" "}
          <Badge variant="secondary" className="mx-0.5">Free/Pro</Badge>, o cardápio exibirá apenas produtos da
          categoria <span className="font-medium text-foreground">'Água'</span>. No plano{" "}
          <Badge className="mx-0.5 bg-amber-500 text-white hover:bg-amber-500">Business</Badge>, todo o seu
          catálogo (bebidas, descartáveis, etc.) fica liberado automaticamente.
        </p>
      </div>
    ),
  },
  {
    value: "pdv",
    emoji: "⚡",
    titulo: "Vendas no balcão (PDV / Novo Pedido)",
    badge: "Operação",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">O que é:</span> Onde você registra vendas que chegam por
          ligação ou direto no balcão da distribuidora.
        </p>
        <p>
          <span className="font-semibold text-foreground">Inteligência de telefone:</span> Ao abrir o "Novo
          Pedido" e digitar o telefone do cliente, o sistema faz uma busca instantânea.
        </p>
        <ul className="space-y-2 pl-1">
          <li className="flex gap-2">
            <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-700">
              ✓ Cliente já cadastrado
            </span>
            <span>Preenche nome e endereço na hora.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full bg-sky-100 px-2 text-[11px] font-semibold text-sky-700">
              ✨ Cliente novo
            </span>
            <span>Salva o cadastro automaticamente quando o pedido é finalizado.</span>
          </li>
        </ul>
        <p className="rounded-lg bg-muted/60 p-3 text-xs">
          💡 O telefone é salvo de forma limpa (só dígitos) para evitar duplicidades.
        </p>
      </div>
    ),
  },
  {
    value: "clientes",
    emoji: "👥",
    titulo: "Meus clientes (CRM e histórico)",
    badge: "CRM",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">O que é:</span> A sua base de dados inteligente de
          consumidores.
        </p>
        <p>
          <span className="font-semibold text-foreground">Recursos:</span> Busque clientes em tempo real
          digitando o <span className="font-medium text-foreground">Nome</span> OU o{" "}
          <span className="font-medium text-foreground">Telefone</span> na barra de pesquisa. Você também pode
          cadastrar um cliente ativamente clicando em{" "}
          <span className="font-medium text-foreground">'+ Novo Cliente'</span> (com busca automática de endereço
          pelo CEP).
        </p>
        <p>
          <span className="font-semibold text-foreground">Linha do tempo lateral:</span> Ao clicar no nome de{" "}
          <span className="font-medium text-foreground">qualquer cliente</span> em qualquer tela do app, um
          painel deslizará mostrando a ficha dele e o Histórico Completo de Pedidos, informando inclusive qual
          motoca foi responsável por aquela entrega no passado.
        </p>
      </div>
    ),
  },
  {
    value: "frota",
    emoji: "🏍️",
    titulo: "Gestão de frota e entregadores",
    badge: "Logística",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">O que é:</span> O controle logístico das suas motos e
          entregas.
        </p>
        <div>
          <p className="mb-2 font-semibold text-foreground">O fluxo automático:</p>
          <ol className="space-y-3">
            {[
              <>Cadastre seus motocas na tela <span className="font-medium text-foreground">'Entregadores'</span> informando Nome, Moto e Placa. Eles ficarão com status <Badge className="mx-0.5 bg-emerald-500 hover:bg-emerald-500">Disponível</Badge>.</>,
              <>No Dashboard, ao receber um pedido, clique em <span className="font-medium text-foreground">'Atribuir Entregador'</span> e selecione o motoca disponível.</>,
              <>Automaticamente o pedido muda para <Badge className="mx-0.5 bg-sky-500 hover:bg-sky-500">Em Rota</Badge>, o cliente recebe notificação e o entregador fica ocupado.</>,
              <>Quando o entregador finalizar a entrega pelo painel dele (<code className="rounded bg-muted px-1 text-xs text-foreground">/entregador</code>), a moto é liberada automaticamente voltando para <Badge className="mx-0.5 bg-emerald-500 hover:bg-emerald-500">Disponível</Badge>.</>,
            ].map((txt, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span>{txt}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    ),
  },
  {
    value: "horario",
    emoji: "🌙",
    titulo: "Horário de funcionamento e pré-pedidos",
    badge: "Automação",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Como funciona:</span> Em{" "}
          <span className="font-medium text-foreground">'Configurações'</span>, você define o horário exato de
          abertura e fechamento para cada dia da semana (ajustado ao fuso horário de Brasília).
        </p>
        <p>
          <span className="font-semibold text-foreground">O pré-pedido:</span> Se um cliente acessar o seu link
          enquanto você estiver fechado, o sistema avisa que a loja está fechada, mas{" "}
          <span className="font-medium text-foreground">PERMITE</span> que ele faça o pedido para garantir a vaga.
        </p>
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          🔔 <span className="font-semibold">Alerta de abertura:</span> Assim que você abrir o sistema no dia
          seguinte, um alerta GIGANTE e uma notificação sonora soarão no seu painel avisando que existem
          pré-pedidos na fila de prioridade aguardando o despacho.
        </p>
      </div>
    ),
  },
  {
    value: "textos",
    emoji: "📝",
    titulo: "Padronização de textos (organização visual)",
    badge: "UX",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>O Pedirápido organiza seus textos automaticamente para manter o sistema bonito e profissional:</p>
        <ul className="space-y-3">
          <li className="rounded-lg border border-border bg-card p-3">
            <p className="font-semibold text-foreground">Nomes de clientes e entregadores</p>
            <p className="mt-1 text-xs">
              Salvos em <span className="font-mono text-foreground">CAIXA ALTA</span> (ex:{" "}
              <span className="font-mono text-foreground">LUIS MOREIRA</span>), mas o sistema mantém conectivos
              em letras minúsculas (<em>de, do, da, e</em>).
            </p>
          </li>
          <li className="rounded-lg border border-border bg-card p-3">
            <p className="font-semibold text-foreground">Nomes e descrições de produtos</p>
            <p className="mt-1 text-xs">
              Começam sempre com a <span className="font-mono text-foreground">PRIMEIRA PALAVRA EM CAIXA ALTA</span>{" "}
              para destacar a marca no cardápio do cliente (ex:{" "}
              <span className="font-mono text-foreground">CRYSTAL Água mineral</span>).
            </p>
          </li>
        </ul>
      </div>
    ),
  },
];

function AjudaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background pb-28">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/70 px-5 pb-10 pt-8 text-primary-foreground">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <HelpCircle className="h-3.5 w-3.5" />
            Central de ajuda
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            CENTRAL de ajuda — Pedirápido <span className="ml-1">💧</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-primary-foreground/90">
            Bem-vindo! Aqui você entende como extrair o máximo de poder do seu sistema de gestão e delivery.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-2xl px-4">
        <Card className="rounded-2xl border-border/60 p-2 shadow-sm sm:p-4">
          <Accordion type="single" collapsible defaultValue="cardapio" className="w-full">
            {CATEGORIAS.map((cat) => (
              <AccordionItem
                key={cat.value}
                value={cat.value}
                className="border-b border-border/60 last:border-b-0"
              >
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex flex-1 items-center gap-3 pr-2 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                      {cat.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{cat.titulo}</p>
                      {cat.badge ? (
                        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {cat.badge}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-1 pb-5 pl-14">{cat.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ainda com dúvidas? Fale com o suporte pelo WhatsApp em{" "}
          <span className="font-medium text-foreground">Perfil → Suporte</span>.
        </p>
      </main>
    </div>
  );
}
