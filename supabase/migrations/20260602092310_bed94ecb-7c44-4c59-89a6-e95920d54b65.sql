
-- 1. Profile extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS sandbox_html text,
  ADD COLUMN IF NOT EXISTS owned_emojis text[] NOT NULL DEFAULT '{}'::text[];

-- 2. Chats
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY chats_select_participant ON public.chats
  FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY chats_insert_participant ON public.chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY chats_update_participant ON public.chats
  FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

-- 3. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages(chat_id, created_at DESC);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chats c
            WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid()))
  );
CREATE POLICY messages_insert_participant ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- 4. Subscribe to premium (rflow or fflow)
CREATE OR REPLACE FUNCTION public.app_subscribe_premium(currency text, months integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  w record;
  cost_rflow bigint;
  cost_fflow bigint;
  base_ts timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF months IS NULL OR months <= 0 OR months > 24 THEN RAISE EXCEPTION 'invalid_months'; END IF;
  IF currency NOT IN ('rflow','fflow') THEN RAISE EXCEPTION 'invalid_currency'; END IF;

  cost_rflow := months * 49000;   -- 49 000 rFLOW / мес
  cost_fflow := months * 1200;    -- 1200 fFLOW / мес

  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;

  IF currency = 'rflow' THEN
    IF w.rflow_balance < cost_rflow THEN RAISE EXCEPTION 'insufficient_rflow'; END IF;
    UPDATE public.wallets SET rflow_balance = rflow_balance - cost_rflow, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.transactions(user_id, type, rflow_delta, counterparty, note)
    VALUES (uid, 'donation', -cost_rflow, 'FLOW Premium', 'Подписка Premium ('||months||' мес)');
  ELSE
    IF w.fflow_active < cost_fflow THEN RAISE EXCEPTION 'insufficient_fflow'; END IF;
    UPDATE public.wallets SET fflow_active = fflow_active - cost_fflow, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.transactions(user_id, type, fflow_active_delta, counterparty, note)
    VALUES (uid, 'donation', -cost_fflow, 'FLOW Premium', 'Подписка Premium ('||months||' мес)');
  END IF;

  SELECT GREATEST(COALESCE(premium_until, now()), now()) INTO base_ts FROM public.profiles WHERE id = uid;
  UPDATE public.profiles SET premium_until = base_ts + (months || ' months')::interval WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'premium_until', base_ts + (months || ' months')::interval);
END;
$$;

-- 5. Buy emoji
CREATE OR REPLACE FUNCTION public.app_purchase_emoji(emoji_id text, cost integer, currency text DEFAULT 'fflow')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w record; owned boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF cost < 0 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
  IF currency NOT IN ('fflow','rflow') THEN RAISE EXCEPTION 'invalid_currency'; END IF;

  SELECT (emoji_id = ANY(owned_emojis)) INTO owned FROM public.profiles WHERE id = uid;
  IF owned THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  -- premium-only emojis are gated client-side; here we just charge
  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF currency = 'fflow' THEN
    IF w.fflow_active < cost THEN RAISE EXCEPTION 'insufficient_fflow'; END IF;
    UPDATE public.wallets SET fflow_active = fflow_active - cost, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.transactions(user_id, type, fflow_active_delta, counterparty, note)
    VALUES (uid, 'donation', -cost, 'FLOW Shop', 'Эмодзи: '||emoji_id);
  ELSE
    IF w.rflow_balance < cost THEN RAISE EXCEPTION 'insufficient_rflow'; END IF;
    UPDATE public.wallets SET rflow_balance = rflow_balance - cost, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.transactions(user_id, type, rflow_delta, counterparty, note)
    VALUES (uid, 'donation', -cost, 'FLOW Shop', 'Эмодзи: '||emoji_id);
  END IF;

  UPDATE public.profiles SET owned_emojis = array_append(owned_emojis, emoji_id) WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'emoji', emoji_id);
END;
$$;

-- 6. Open or create a chat with a username
CREATE OR REPLACE FUNCTION public.app_open_chat(other_username text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  other_id uuid;
  ua uuid; ub uuid;
  chat_row record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO other_id FROM public.profiles WHERE lower(username) = lower(other_username);
  IF other_id IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF other_id = uid THEN RAISE EXCEPTION 'self_chat_forbidden'; END IF;

  IF uid < other_id THEN ua := uid; ub := other_id; ELSE ua := other_id; ub := uid; END IF;

  SELECT * INTO chat_row FROM public.chats WHERE user_a = ua AND user_b = ub;
  IF chat_row.id IS NULL THEN
    INSERT INTO public.chats(user_a, user_b) VALUES (ua, ub) RETURNING * INTO chat_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'chat_id', chat_row.id, 'other_id', other_id);
END;
$$;

-- 7. Send a message
CREATE OR REPLACE FUNCTION public.app_send_message(chat_id uuid, body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_part boolean; blocked boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF body IS NULL OR length(trim(body)) = 0 THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF length(body) > 2000 THEN RAISE EXCEPTION 'too_long'; END IF;

  SELECT is_blocked INTO blocked FROM public.profiles WHERE id = uid;
  IF blocked THEN RAISE EXCEPTION 'sender_blocked'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.chats WHERE id = chat_id AND (user_a = uid OR user_b = uid)) INTO is_part;
  IF NOT is_part THEN RAISE EXCEPTION 'not_participant'; END IF;

  INSERT INTO public.messages(chat_id, sender_id, body) VALUES (chat_id, uid, body);
  UPDATE public.chats SET last_message_at = now() WHERE id = chat_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 8. Update profile extras (premium-gated)
CREATE OR REPLACE FUNCTION public.app_update_profile_extras(
  p_social_links jsonb DEFAULT NULL,
  p_audio_url text DEFAULT NULL,
  p_sandbox_html text DEFAULT NULL,
  p_bio text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_premium boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT (premium_until IS NOT NULL AND premium_until > now()) INTO is_premium FROM public.profiles WHERE id = uid;

  IF p_bio IS NOT NULL THEN
    UPDATE public.profiles SET bio = left(p_bio, 280) WHERE id = uid;
  END IF;

  IF (p_social_links IS NOT NULL OR p_audio_url IS NOT NULL OR p_sandbox_html IS NOT NULL) AND NOT is_premium THEN
    RAISE EXCEPTION 'premium_required';
  END IF;

  IF p_social_links IS NOT NULL THEN
    UPDATE public.profiles SET social_links = p_social_links WHERE id = uid;
  END IF;
  IF p_audio_url IS NOT NULL THEN
    UPDATE public.profiles SET audio_url = NULLIF(p_audio_url, '') WHERE id = uid;
  END IF;
  IF p_sandbox_html IS NOT NULL THEN
    UPDATE public.profiles SET sandbox_html = NULLIF(left(p_sandbox_html, 200000), '') WHERE id = uid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'premium', is_premium);
END;
$$;

-- 9. List my chats with the other participant info
CREATE OR REPLACE FUNCTION public.app_list_chats()
RETURNS TABLE(chat_id uuid, other_id uuid, other_username text, other_display_name text,
              other_is_verified boolean, other_is_author boolean,
              last_message_at timestamptz, last_body text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT c.id,
         p.id, p.username, p.display_name, p.is_verified, p.is_author,
         c.last_message_at,
         (SELECT m.body FROM public.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1)
    FROM public.chats c
    JOIN public.profiles p ON p.id = CASE WHEN c.user_a = uid THEN c.user_b ELSE c.user_a END
   WHERE c.user_a = uid OR c.user_b = uid
   ORDER BY c.last_message_at DESC
   LIMIT 100;
END;
$$;
