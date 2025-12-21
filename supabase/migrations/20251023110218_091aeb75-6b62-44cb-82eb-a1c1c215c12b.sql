-- Update handle_new_user function to include Australian location data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, company_name, state, city, postcode)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'postcode'
  );
  RETURN NEW;
END;
$$;