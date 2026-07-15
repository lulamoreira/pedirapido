
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entregadores_user_id_key ON public.entregadores(user_id) WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Entregador vê e atualiza seu próprio cadastro" ON public.entregadores;
CREATE POLICY "Entregador vê e atualiza seu próprio cadastro"
  ON public.entregadores
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
