
ALTER TABLE public.distribuidoras
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS logradouro TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;

-- Política pública para rastreamento por link (últimos 3 dias)
GRANT SELECT ON public.pedidos TO anon;
DROP POLICY IF EXISTS "public tracking by link" ON public.pedidos;
CREATE POLICY "public tracking by link" ON public.pedidos
  FOR SELECT TO anon
  USING (created_at > now() - interval '3 days');
