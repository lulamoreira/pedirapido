
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin_master', 'distribuidora', 'entregador');
CREATE TYPE public.plano_tipo AS ENUM ('free', 'pro', 'business');
CREATE TYPE public.status_assinatura_tipo AS ENUM ('ativo', 'suspenso', 'cancelado');
CREATE TYPE public.pedido_status AS ENUM ('pendente', 'preparo', 'pago', 'rota', 'entregue', 'cancelado');

-- DISTRIBUIDORAS
CREATE TABLE public.distribuidoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  plano public.plano_tipo NOT NULL DEFAULT 'free',
  trial_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  status_assinatura public.status_assinatura_tipo NOT NULL DEFAULT 'ativo',
  taxa_entrega_padrao NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distribuidoras TO authenticated;
GRANT ALL ON public.distribuidoras TO service_role;
ALTER TABLE public.distribuidoras ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  distribuidora_id UUID REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, distribuidora_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- get_user_distribuidora_id (owner or entregador)
CREATE OR REPLACE FUNCTION public.get_user_distribuidora_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.distribuidoras WHERE owner_user_id = _user_id
  UNION ALL
  SELECT distribuidora_id FROM public.user_roles
    WHERE user_id = _user_id AND role = 'entregador' AND distribuidora_id IS NOT NULL
  LIMIT 1;
$$;

-- CLIENTES
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id UUID NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  cep TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (distribuidora_id, telefone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- PRODUTOS
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id UUID NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  estoque_minimo INTEGER NOT NULL DEFAULT 10,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- PEDIDOS
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id UUID NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  entregador_id UUID,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.pedido_status NOT NULL DEFAULT 'pendente',
  codigo_pix TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_at TIMESTAMPTZ,
  entregue_at TIMESTAMPTZ
);
CREATE INDEX idx_pedidos_distribuidora ON public.pedidos(distribuidora_id, created_at DESC);
CREATE INDEX idx_pedidos_status ON public.pedidos(distribuidora_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- PEDIDO ITENS
CREATE TABLE public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unit NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);
CREATE INDEX idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT ALL ON public.pedido_itens TO service_role;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

-- POLICIES: distribuidoras
CREATE POLICY "Owner reads own distribuidora" ON public.distribuidoras
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Owner updates own distribuidora" ON public.distribuidoras
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can insert distribuidoras" ON public.distribuidoras
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can delete distribuidoras" ON public.distribuidoras
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));

-- POLICIES: user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_master'));

-- POLICIES: clientes
CREATE POLICY "Distribuidora manages own clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- POLICIES: produtos
CREATE POLICY "Distribuidora manages own produtos" ON public.produtos
  FOR ALL TO authenticated
  USING (distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- POLICIES: pedidos
CREATE POLICY "Distribuidora manages own pedidos" ON public.pedidos
  FOR ALL TO authenticated
  USING (distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'));

-- POLICIES: pedido_itens
CREATE POLICY "Distribuidora manages own pedido_itens" ON public.pedido_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND (p.distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND (p.distribuidora_id = public.get_user_distribuidora_id(auth.uid()) OR public.has_role(auth.uid(), 'admin_master'))));

-- TRIGGER handle_new_user: cria distribuidora + role automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_dist_id UUID;
BEGIN
  INSERT INTO public.distribuidoras (owner_user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_distribuidora', 'Minha Distribuidora'),
    NEW.email
  )
  RETURNING id INTO new_dist_id;

  INSERT INTO public.user_roles (user_id, role, distribuidora_id)
  VALUES (NEW.id, 'distribuidora', new_dist_id);

  -- Seed produtos de exemplo
  INSERT INTO public.produtos (distribuidora_id, nome, descricao, preco, estoque, estoque_minimo)
  VALUES
    (new_dist_id, 'Galão 20L', 'Água mineral galão 20 litros', 12.00, 50, 10),
    (new_dist_id, 'Galão 10L', 'Água mineral galão 10 litros', 8.00, 30, 8),
    (new_dist_id, 'Pack 1,5L (6un)', 'Pack com 6 garrafas de 1,5L', 15.00, 40, 12);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_dist_updated BEFORE UPDATE ON public.distribuidoras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
