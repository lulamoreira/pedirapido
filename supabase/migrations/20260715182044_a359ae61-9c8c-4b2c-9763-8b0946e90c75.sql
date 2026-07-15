
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_dist_id UUID;
  is_first_user BOOLEAN;
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

  -- Primeiro usuário do sistema vira admin_master
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin_master'
  ) INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin_master');
  END IF;

  INSERT INTO public.produtos (distribuidora_id, nome, descricao, preco, estoque, estoque_minimo)
  VALUES
    (new_dist_id, 'Galão 20L', 'Água mineral galão 20 litros', 12.00, 50, 10),
    (new_dist_id, 'Galão 10L', 'Água mineral galão 10 litros', 8.00, 30, 8),
    (new_dist_id, 'Pack 1,5L (6un)', 'Pack com 6 garrafas de 1,5L', 15.00, 40, 12);

  RETURN NEW;
END;
$function$;

-- Garantir trigger conectado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
