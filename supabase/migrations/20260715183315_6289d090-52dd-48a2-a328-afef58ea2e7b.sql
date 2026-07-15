
-- 1. Forma de pagamento
DO $$ BEGIN
  CREATE TYPE public.forma_pagamento AS ENUM ('pix','cartao','dinheiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento NOT NULL DEFAULT 'pix';

-- 2. Config da distribuidora
ALTER TABLE public.distribuidoras
  ADD COLUMN IF NOT EXISTS horario_abertura TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fechamento TEXT NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS tempo_estimado_min INTEGER NOT NULL DEFAULT 45;

-- 3. Entregadores
DO $$ BEGIN
  CREATE TYPE public.entregador_status AS ENUM ('disponivel','em_entrega','inativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.entregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id UUID NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  veiculo_modelo TEXT,
  veiculo_placa TEXT,
  status public.entregador_status NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entregadores_dist ON public.entregadores(distribuidora_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregadores TO authenticated;
GRANT ALL ON public.entregadores TO service_role;

ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono da distribuidora gerencia sua equipe"
  ON public.entregadores FOR ALL
  USING (distribuidora_id = public.get_user_distribuidora_id(auth.uid()))
  WITH CHECK (distribuidora_id = public.get_user_distribuidora_id(auth.uid()));

CREATE TRIGGER trg_entregadores_updated_at
  BEFORE UPDATE ON public.entregadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Trigger novo usuário: promove Admin Master fixo + primeiro usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_dist_id UUID;
  is_first_user BOOLEAN;
  is_master_email BOOLEAN;
BEGIN
  INSERT INTO public.distribuidoras (owner_user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_distribuidora', NEW.raw_user_meta_data->>'full_name', 'Minha Distribuidora'),
    NEW.email
  )
  RETURNING id INTO new_dist_id;

  INSERT INTO public.user_roles (user_id, role, distribuidora_id)
  VALUES (NEW.id, 'distribuidora', new_dist_id);

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin_master') INTO is_first_user;
  is_master_email := lower(NEW.email) IN ('lula1973@gmail.com','lula1973@gmail.com.br');

  IF is_first_user OR is_master_email THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin_master')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.produtos (distribuidora_id, nome, descricao, preco, estoque, estoque_minimo)
  VALUES
    (new_dist_id, 'Galão 20L', 'Água mineral galão 20 litros', 12.00, 50, 10),
    (new_dist_id, 'Galão 10L', 'Água mineral galão 10 litros', 8.00, 30, 8),
    (new_dist_id, 'Pack 1,5L (6un)', 'Pack com 6 garrafas de 1,5L', 15.00, 40, 12);

  RETURN NEW;
END;
$function$;

-- 5. Promove imediatamente qualquer usuário existente com esses emails
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin_master'::app_role
FROM auth.users u
WHERE lower(u.email) IN ('lula1973@gmail.com','lula1973@gmail.com.br')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin_master'
  );
