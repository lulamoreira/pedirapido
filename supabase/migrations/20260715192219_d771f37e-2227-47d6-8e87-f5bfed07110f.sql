
-- 1) produtos: volume
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS volume_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS volume_unidade TEXT;

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_volume_unidade_check;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_volume_unidade_check
  CHECK (volume_unidade IS NULL OR volume_unidade IN ('L','ml'));

-- Backfill best-effort a partir do nome ("Galão 20L", "Pack 1,5L", "500ml")
UPDATE public.produtos
SET volume_valor = CASE
      WHEN nome ~* '([0-9]+[.,]?[0-9]*)\s*L\b' THEN
        replace((regexp_match(nome, '([0-9]+[.,]?[0-9]*)\s*L\b','i'))[1], ',', '.')::numeric
      WHEN nome ~* '([0-9]+)\s*ml\b' THEN
        (regexp_match(nome, '([0-9]+)\s*ml\b','i'))[1]::numeric
      ELSE NULL
    END,
    volume_unidade = CASE
      WHEN nome ~* '[0-9][.,]?[0-9]*\s*L\b' THEN 'L'
      WHEN nome ~* '[0-9]+\s*ml\b' THEN 'ml'
      ELSE NULL
    END
WHERE volume_valor IS NULL;

-- 2) distribuidoras: nome_fantasia + razao_social
ALTER TABLE public.distribuidoras
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS razao_social TEXT;

UPDATE public.distribuidoras
SET nome_fantasia = COALESCE(nome_fantasia, nome)
WHERE nome_fantasia IS NULL;

-- Trigger: manter public.distribuidoras.nome sincronizado com nome_fantasia
CREATE OR REPLACE FUNCTION public.sync_distribuidora_nome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome_fantasia IS NOT NULL AND NEW.nome_fantasia <> '' THEN
    NEW.nome := NEW.nome_fantasia;
  ELSIF NEW.nome IS NOT NULL AND (NEW.nome_fantasia IS NULL OR NEW.nome_fantasia = '') THEN
    NEW.nome_fantasia := NEW.nome;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS distribuidoras_sync_nome ON public.distribuidoras;
CREATE TRIGGER distribuidoras_sync_nome
BEFORE INSERT OR UPDATE ON public.distribuidoras
FOR EACH ROW EXECUTE FUNCTION public.sync_distribuidora_nome();
