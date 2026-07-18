ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS mp_payment_id text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pix_qr_base64 text;