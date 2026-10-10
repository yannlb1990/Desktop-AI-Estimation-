-- ============================================================
-- Client quote approval links
--
-- The estimator shares a link /quote/<token>. The client (not signed in) can read
-- that one quote and answer once (approve / request changes). Clients never get
-- table access: reads and answers go through two SECURITY DEFINER functions keyed
-- on the unguessable token. The estimator's app reads the answer back (owner RLS)
-- and records the approved quote on the project.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quote_shares (
  token            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL,
  quote_version_id uuid,
  payload          jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'changes_requested')),
  responded_name   text,
  responded_at     timestamptz,
  comments         text,
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_shares_project ON public.quote_shares (project_id, created_at DESC);

ALTER TABLE public.quote_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_shares_owner_all" ON public.quote_shares;
CREATE POLICY "quote_shares_owner_all"
  ON public.quote_shares FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Client view of one quote by token. Returns nothing if the token is unknown.
CREATE OR REPLACE FUNCTION public.get_quote_share(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'token', s.token,
    'payload', s.payload,
    'status', s.status,
    'responded_name', s.responded_name,
    'responded_at', s.responded_at,
    'comments', s.comments,
    'expires_at', s.expires_at,
    'expired', s.expires_at < now()
  )
  FROM public.quote_shares s
  WHERE s.token = p_token;
$$;

-- Client answer. Only once, only while pending and not expired.
CREATE OR REPLACE FUNCTION public.respond_quote_share(
  p_token uuid,
  p_status text,
  p_name text,
  p_comments text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.quote_shares%ROWTYPE;
BEGIN
  IF p_status NOT IN ('approved', 'changes_requested') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'name required';
  END IF;

  SELECT * INTO v_share FROM public.quote_shares WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF v_share.expires_at < now() THEN
    RAISE EXCEPTION 'expired';
  END IF;
  IF v_share.status <> 'pending' THEN
    RAISE EXCEPTION 'already answered';
  END IF;

  UPDATE public.quote_shares
     SET status = p_status,
         responded_name = left(trim(p_name), 200),
         responded_at = now(),
         comments = left(p_comments, 4000)
   WHERE token = p_token;

  RETURN public.get_quote_share(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.get_quote_share(uuid) FROM public;
REVOKE ALL ON FUNCTION public.respond_quote_share(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_quote_share(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_quote_share(uuid, text, text, text) TO anon, authenticated;
