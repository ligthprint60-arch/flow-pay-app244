
-- Add new profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_note text;

-- Admin check (single trusted email, easy to extend later)
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
     WHERE id = _uid
       AND lower(email) = 'studioinfinit81@gmail.com'
  );
$$;

-- Block-aware P2P override (replace previous version)
CREATE OR REPLACE FUNCTION public.app_p2p_transfer(recipient_username text, amount bigint, memo text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sender_id uuid := auth.uid();
  recipient record;
  sender_w  record;
  sender_blocked boolean;
BEGIN
  IF sender_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF amount IS NULL OR amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT is_blocked INTO sender_blocked FROM public.profiles WHERE id = sender_id;
  IF sender_blocked THEN RAISE EXCEPTION 'sender_blocked'; END IF;

  SELECT id, username, display_name, is_blocked INTO recipient
    FROM public.profiles WHERE lower(username) = lower(recipient_username);
  IF recipient.id IS NULL THEN RAISE EXCEPTION 'recipient_not_found'; END IF;
  IF recipient.is_blocked THEN RAISE EXCEPTION 'recipient_blocked'; END IF;
  IF recipient.id = sender_id THEN RAISE EXCEPTION 'self_transfer_forbidden'; END IF;

  SELECT * INTO sender_w FROM public.wallets WHERE user_id = sender_id FOR UPDATE;
  IF sender_w.rflow_balance < amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  UPDATE public.wallets SET rflow_balance = rflow_balance - amount, updated_at = now() WHERE user_id = sender_id;
  UPDATE public.wallets SET rflow_balance = rflow_balance + amount, updated_at = now() WHERE user_id = recipient.id;

  INSERT INTO public.transactions (user_id, type, rflow_delta, counterparty, note)
  VALUES (sender_id, 'transfer', -amount, '@' || recipient.username, COALESCE(memo, 'P2P отправление'));
  INSERT INTO public.transactions (user_id, type, rflow_delta, counterparty, note)
  VALUES (recipient.id, 'transfer', amount,
          '@' || (SELECT username FROM public.profiles WHERE id = sender_id),
          COALESCE(memo, 'P2P получение'));

  RETURN jsonb_build_object('ok', true, 'recipient_username', recipient.username,
                            'recipient_name', recipient.display_name, 'amount', amount);
END;
$$;

-- Posts insert policy add block check
DROP POLICY IF EXISTS posts_insert_author ON public.posts;
CREATE POLICY posts_insert_author ON public.posts
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.is_author = true AND p.is_blocked = false)
);

-- Verification request (user-side)
CREATE OR REPLACE FUNCTION public.app_request_verification(note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles
     SET verification_requested = true,
         verification_note = COALESCE(note, verification_note)
   WHERE id = uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ===== ADMIN FUNCTIONS =====

CREATE OR REPLACE FUNCTION public.app_admin_mint_fflow(target_username text, amount bigint, kind text DEFAULT 'active')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); tgt uuid;
BEGIN
  IF NOT public.is_admin(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF amount IS NULL OR amount = 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF kind NOT IN ('active','pending') THEN RAISE EXCEPTION 'invalid_kind'; END IF;

  SELECT id INTO tgt FROM public.profiles WHERE lower(username) = lower(target_username);
  IF tgt IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF kind = 'active' THEN
    UPDATE public.wallets SET fflow_active = fflow_active + amount, updated_at = now() WHERE user_id = tgt;
    INSERT INTO public.transactions (user_id, type, fflow_active_delta, counterparty, note)
    VALUES (tgt, 'spend_reward', amount, 'FLOW Treasury', 'Admin mint (active)');
  ELSE
    UPDATE public.wallets SET fflow_pending = fflow_pending + amount, updated_at = now() WHERE user_id = tgt;
    INSERT INTO public.transactions (user_id, type, fflow_pending_delta, counterparty, note)
    VALUES (tgt, 'spend_reward', amount, 'FLOW Treasury', 'Admin mint (pending)');
  END IF;

  RETURN jsonb_build_object('ok', true, 'minted', amount, 'kind', kind);
END;
$$;

-- Burn fFLOW globally — proportional across all wallets (from active pool)
CREATE OR REPLACE FUNCTION public.app_admin_burn_fflow_global(amount bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  total_active bigint;
  ratio numeric;
BEGIN
  IF NOT public.is_admin(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF amount IS NULL OR amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT COALESCE(SUM(fflow_active), 0) INTO total_active FROM public.wallets;
  IF total_active = 0 THEN RAISE EXCEPTION 'no_supply'; END IF;
  IF amount > total_active THEN amount := total_active; END IF;

  ratio := amount::numeric / total_active::numeric;

  UPDATE public.wallets
     SET fflow_active = GREATEST(0, fflow_active - FLOOR(fflow_active * ratio)::bigint),
         updated_at = now();

  RETURN jsonb_build_object('ok', true, 'burned_approx', amount, 'prev_supply', total_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_admin_set_flag(target_username text, flag text, value boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF flag NOT IN ('is_verified','is_author','is_blocked') THEN RAISE EXCEPTION 'invalid_flag'; END IF;

  IF flag = 'is_verified' THEN
    UPDATE public.profiles SET is_verified = value,
           verification_requested = CASE WHEN value THEN false ELSE verification_requested END
     WHERE lower(username) = lower(target_username);
  ELSIF flag = 'is_author' THEN
    UPDATE public.profiles SET is_author = value WHERE lower(username) = lower(target_username);
  ELSIF flag = 'is_blocked' THEN
    UPDATE public.profiles SET is_blocked = value WHERE lower(username) = lower(target_username);
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;
  RETURN jsonb_build_object('ok', true, 'flag', flag, 'value', value);
END;
$$;

-- Admin view: search users with verification info & wallet
CREATE OR REPLACE FUNCTION public.app_admin_list_users(search text DEFAULT NULL, only_pending boolean DEFAULT false)
RETURNS TABLE (
  id uuid, username text, display_name text, is_author boolean, is_verified boolean,
  is_blocked boolean, verification_requested boolean, verification_note text,
  rflow_balance bigint, fflow_active bigint, fflow_pending bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.is_author, p.is_verified, p.is_blocked,
           p.verification_requested, p.verification_note,
           COALESCE(w.rflow_balance,0), COALESCE(w.fflow_active,0), COALESCE(w.fflow_pending,0)
      FROM public.profiles p
      LEFT JOIN public.wallets w ON w.user_id = p.id
     WHERE (search IS NULL OR p.username ILIKE '%'||search||'%' OR p.display_name ILIKE '%'||search||'%')
       AND (NOT only_pending OR p.verification_requested = true)
     ORDER BY p.verification_requested DESC, p.created_at DESC
     LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'users',          (SELECT COUNT(*) FROM public.profiles),
    'authors',        (SELECT COUNT(*) FROM public.profiles WHERE is_author),
    'verified',       (SELECT COUNT(*) FROM public.profiles WHERE is_verified),
    'blocked',        (SELECT COUNT(*) FROM public.profiles WHERE is_blocked),
    'pending_verif',  (SELECT COUNT(*) FROM public.profiles WHERE verification_requested AND NOT is_verified),
    'total_rflow',    (SELECT COALESCE(SUM(rflow_balance),0) FROM public.wallets),
    'total_fflow_active',  (SELECT COALESCE(SUM(fflow_active),0) FROM public.wallets),
    'total_fflow_pending', (SELECT COALESCE(SUM(fflow_pending),0) FROM public.wallets)
  ) INTO r;
  RETURN r;
END;
$$;
