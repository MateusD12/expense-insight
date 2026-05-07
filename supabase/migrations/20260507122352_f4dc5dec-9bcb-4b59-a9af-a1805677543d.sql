
DROP POLICY IF EXISTS "Allow public delete access" ON public.expenses;
DROP POLICY IF EXISTS "Allow public insert access" ON public.expenses;
DROP POLICY IF EXISTS "Allow public read access" ON public.expenses;
DROP POLICY IF EXISTS "Allow public update access" ON public.expenses;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, budget)
  VALUES (new.id, NULL);
  RETURN new;
END;
$function$;
