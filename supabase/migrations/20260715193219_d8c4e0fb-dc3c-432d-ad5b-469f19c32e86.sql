
-- 1. Slug column
ALTER TABLE public.distribuidoras ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Slugify function
CREATE OR REPLACE FUNCTION public.slugify(v TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE r TEXT;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  r := lower(v);
  -- transliterate common accents
  r := translate(r,
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaaaaaaaeeeeeeeeiiiiiiiiooooooooooouuuuuuuucCnN');
  r := replace(r, '&', ' e ');
  r := regexp_replace(r, '[^a-z0-9]+', '-', 'g');
  r := regexp_replace(r, '^-+|-+$', '', 'g');
  IF r = '' OR r IS NULL THEN r := 'loja'; END IF;
  RETURN left(r, 60);
END $$;

-- 3. Ensure unique slug (adds numeric suffix if taken by another distribuidora)
CREATE OR REPLACE FUNCTION public.ensure_unique_slug(_base TEXT, _self UUID)
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE candidate TEXT := _base; i INT := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.distribuidoras WHERE slug = candidate AND (id IS DISTINCT FROM _self)) LOOP
    i := i + 1;
    candidate := left(_base, 55) || '-' || i;
  END LOOP;
  RETURN candidate;
END $$;

-- 4. Trigger to auto-generate slug from nome_fantasia
CREATE OR REPLACE FUNCTION public.set_distribuidora_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.ensure_unique_slug(public.slugify(COALESCE(NEW.nome_fantasia, NEW.nome, 'loja')), NEW.id);
  ELSE
    NEW.slug := public.slugify(NEW.slug);
    NEW.slug := public.ensure_unique_slug(NEW.slug, NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_distribuidora_slug ON public.distribuidoras;
CREATE TRIGGER trg_set_distribuidora_slug
BEFORE INSERT OR UPDATE OF slug, nome_fantasia, nome ON public.distribuidoras
FOR EACH ROW EXECUTE FUNCTION public.set_distribuidora_slug();

-- 5. Backfill existing rows
UPDATE public.distribuidoras SET slug = NULL WHERE slug IS NULL OR slug = '';
-- Trigger fires per-row via a no-op update
UPDATE public.distribuidoras SET nome_fantasia = nome_fantasia WHERE slug IS NULL;

-- 6. Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS distribuidoras_slug_unique ON public.distribuidoras(slug);

-- 7. Allow public (anon) to read minimal fields via slug lookup already covered by supabaseAdmin queries.
