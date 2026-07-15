ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'agua'
  CHECK (categoria IN ('agua','bebidas','descartaveis','petiscos','outros'));

CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(distribuidora_id, categoria);