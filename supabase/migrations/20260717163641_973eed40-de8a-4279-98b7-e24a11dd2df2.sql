
CREATE TABLE public.integracoes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id uuid NOT NULL UNIQUE REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  provedor text NOT NULL DEFAULT 'mercadopago',
  mp_user_id text,
  access_token text,
  refresh_token text,
  token_expira_em timestamptz,
  conectado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.integracoes_pagamento TO service_role;
ALTER TABLE public.integracoes_pagamento ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  distribuidora_id uuid NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
