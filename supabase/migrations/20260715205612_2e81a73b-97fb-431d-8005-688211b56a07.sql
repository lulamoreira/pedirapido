
ALTER TABLE public.distribuidoras
  ADD COLUMN IF NOT EXISTS verificacao_whatsapp boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.otp_verificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id uuid NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  codigo_hash text NOT NULL,
  token uuid,
  verificado_at timestamptz,
  expira_em timestamptz NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.otp_verificacoes TO service_role;

CREATE INDEX IF NOT EXISTS otp_verificacoes_dist_tel_created_idx
  ON public.otp_verificacoes (distribuidora_id, telefone, created_at DESC);

ALTER TABLE public.otp_verificacoes ENABLE ROW LEVEL SECURITY;
-- Sem policies: acessível apenas via service role (server functions).
