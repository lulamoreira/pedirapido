
CREATE TABLE public.horarios_funcionamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distribuidora_id UUID NOT NULL REFERENCES public.distribuidoras(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_abertura TIME,
  horario_fechamento TIME,
  is_fechado_o_dia_todo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(distribuidora_id, dia_semana)
);

GRANT SELECT ON public.horarios_funcionamento TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios_funcionamento TO authenticated;
GRANT ALL ON public.horarios_funcionamento TO service_role;

ALTER TABLE public.horarios_funcionamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read business hours"
  ON public.horarios_funcionamento FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Owner manages business hours"
  ON public.horarios_funcionamento FOR ALL
  TO authenticated
  USING (distribuidora_id = public.get_user_distribuidora_id(auth.uid()))
  WITH CHECK (distribuidora_id = public.get_user_distribuidora_id(auth.uid()));

CREATE TRIGGER trg_horarios_updated_at
  BEFORE UPDATE ON public.horarios_funcionamento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_horarios_dist ON public.horarios_funcionamento(distribuidora_id);

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS is_pre_order BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_pedidos_pre_order ON public.pedidos(distribuidora_id, status) WHERE is_pre_order = true;
