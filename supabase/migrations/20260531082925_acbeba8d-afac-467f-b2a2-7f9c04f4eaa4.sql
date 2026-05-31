
-- 1. Customization columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accent_theme text NOT NULL DEFAULT 'emerald',
  ADD COLUMN IF NOT EXISTS card_skin    text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS owned_accents text[] NOT NULL DEFAULT ARRAY['emerald']::text[],
  ADD COLUMN IF NOT EXISTS owned_skins   text[] NOT NULL DEFAULT ARRAY['default']::text[];

-- 2. P2P transfer (rFLOW) by username — atomic, SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.app_p2p_transfer(
  recipient_username text,
  amount bigint,
  memo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_id  uuid := auth.uid();
  recipient  record;
  sender_w   record;
BEGIN
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id, username, display_name INTO recipient
    FROM public.profiles
   WHERE lower(username) = lower(recipient_username);
  IF recipient.id IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;
  IF recipient.id = sender_id THEN
    RAISE EXCEPTION 'self_transfer_forbidden';
  END IF;

  SELECT * INTO sender_w FROM public.wallets WHERE user_id = sender_id FOR UPDATE;
  IF sender_w.rflow_balance < amount THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  UPDATE public.wallets
     SET rflow_balance = rflow_balance - amount, updated_at = now()
   WHERE user_id = sender_id;

  UPDATE public.wallets
     SET rflow_balance = rflow_balance + amount, updated_at = now()
   WHERE user_id = recipient.id;

  INSERT INTO public.transactions (user_id, type, rflow_delta, counterparty, note)
  VALUES (sender_id,    'transfer', -amount, '@' || recipient.username, COALESCE(memo, 'P2P отправление'));

  INSERT INTO public.transactions (user_id, type, rflow_delta, counterparty, note)
  VALUES (recipient.id, 'transfer',  amount,
          '@' || (SELECT username FROM public.profiles WHERE id = sender_id),
          COALESCE(memo, 'P2P получение'));

  RETURN jsonb_build_object(
    'ok', true,
    'recipient_username', recipient.username,
    'recipient_name', recipient.display_name,
    'amount', amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_p2p_transfer(text, bigint, text) TO authenticated;

-- 3. Purchase customization — burns active fFLOW
CREATE OR REPLACE FUNCTION public.app_purchase_customization(
  item_type text,   -- 'accent' | 'skin'
  item_id   text,
  cost      integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  w   record;
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF cost < 0 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
  IF item_type NOT IN ('accent','skin') THEN RAISE EXCEPTION 'invalid_item_type'; END IF;

  -- check ownership
  IF item_type = 'accent' THEN
    SELECT (item_id = ANY(owned_accents)) INTO already FROM public.profiles WHERE id = uid;
  ELSE
    SELECT (item_id = ANY(owned_skins))   INTO already FROM public.profiles WHERE id = uid;
  END IF;

  IF NOT already THEN
    SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
    IF w.fflow_active < cost THEN RAISE EXCEPTION 'insufficient_fflow'; END IF;

    UPDATE public.wallets
       SET fflow_active = fflow_active - cost, updated_at = now()
     WHERE user_id = uid;

    IF item_type = 'accent' THEN
      UPDATE public.profiles
         SET owned_accents = array_append(owned_accents, item_id),
             accent_theme  = item_id
       WHERE id = uid;
    ELSE
      UPDATE public.profiles
         SET owned_skins = array_append(owned_skins, item_id),
             card_skin   = item_id
       WHERE id = uid;
    END IF;

    INSERT INTO public.transactions (user_id, type, fflow_active_delta, counterparty, note)
    VALUES (uid, 'donation', -cost, 'FLOW Shop', 'Кастомизация: ' || item_type || '/' || item_id);
  ELSE
    -- already owned → just equip
    IF item_type = 'accent' THEN
      UPDATE public.profiles SET accent_theme = item_id WHERE id = uid;
    ELSE
      UPDATE public.profiles SET card_skin = item_id WHERE id = uid;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'equipped', item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_purchase_customization(text, text, integer) TO authenticated;
