
CREATE TABLE public.notificacoes_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distribuidora_id UUID NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('rota','entregue')),
  telefone TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','falha','simulado')),
  provider_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_wa_pedido ON public.notificacoes_whatsapp(pedido_id);
CREATE INDEX idx_notif_wa_dist ON public.notificacoes_whatsapp(distribuidora_id);

GRANT SELECT ON public.notificacoes_whatsapp TO authenticated;
GRANT ALL ON public.notificacoes_whatsapp TO service_role;

ALTER TABLE public.notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own notifs"
  ON public.notificacoes_whatsapp FOR SELECT
  TO authenticated
  USING (distribuidora_id = public.get_user_distribuidora_id(auth.uid()));
