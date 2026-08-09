-- Fix assembly_trades view: use SECURITY INVOKER so RLS policies on
-- assembly_components are respected by the calling user's role.
DROP VIEW IF EXISTS public.assembly_trades;

CREATE VIEW public.assembly_trades
  WITH (security_invoker = true)
AS
  SELECT DISTINCT assembly_id, trade_id
  FROM public.assembly_components;
