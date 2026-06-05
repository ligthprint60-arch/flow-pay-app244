
-- ============ Profiles: app background ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_background_url text;

-- ============ Notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body  text NOT NULL,
  kind  text NOT NULL DEFAULT 'info',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_read_all_auth" ON public.notifications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "notif_admin_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "notif_admin_delete" ON public.notifications
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nr_own" ON public.notification_reads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ Custom Emojis ============
CREATE TABLE IF NOT EXISTS public.custom_emojis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  shortcode text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, shortcode)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_emojis TO authenticated;
GRANT ALL ON public.custom_emojis TO service_role;
ALTER TABLE public.custom_emojis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_read_all" ON public.custom_emojis FOR SELECT TO authenticated USING (true);
CREATE POLICY "ce_owner_write" ON public.custom_emojis
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ce_owner_delete" ON public.custom_emojis
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ============ Chat per-user settings ============
CREATE TABLE IF NOT EXISTS public.chat_settings (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  background_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_settings TO authenticated;
GRANT ALL ON public.chat_settings TO service_role;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_own" ON public.chat_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ Functions ============
CREATE OR REPLACE FUNCTION public.app_admin_broadcast(p_title text, p_body text, p_kind text DEFAULT 'info')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); nid uuid;
BEGIN
  IF NOT public.is_admin(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'empty_title'; END IF;
  IF p_body  IS NULL OR length(trim(p_body))  = 0 THEN RAISE EXCEPTION 'empty_body';  END IF;
  INSERT INTO public.notifications(title, body, kind, created_by)
    VALUES (left(p_title,160), left(p_body,1200), COALESCE(p_kind,'info'), uid)
    RETURNING id INTO nid;
  RETURN jsonb_build_object('ok', true, 'id', nid);
END $$;

CREATE OR REPLACE FUNCTION public.app_set_chat_background(p_chat_id uuid, p_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ok boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.chats WHERE id = p_chat_id AND (user_a = uid OR user_b = uid)) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'not_participant'; END IF;
  INSERT INTO public.chat_settings(chat_id, user_id, background_url, updated_at)
    VALUES (p_chat_id, uid, NULLIF(p_url,''), now())
  ON CONFLICT (chat_id, user_id)
    DO UPDATE SET background_url = NULLIF(p_url,''), updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.app_create_custom_emoji(p_shortcode text, p_image_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_premium boolean; cnt int; sc text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT (premium_until IS NOT NULL AND premium_until > now()) INTO is_premium FROM public.profiles WHERE id = uid;
  IF NOT is_premium THEN RAISE EXCEPTION 'premium_required'; END IF;
  sc := lower(regexp_replace(coalesce(p_shortcode,''), '[^a-z0-9_]', '', 'g'));
  IF length(sc) < 2 OR length(sc) > 24 THEN RAISE EXCEPTION 'invalid_shortcode'; END IF;
  IF p_image_url IS NULL OR length(p_image_url) < 5 THEN RAISE EXCEPTION 'invalid_image'; END IF;
  SELECT count(*) INTO cnt FROM public.custom_emojis WHERE owner_id = uid;
  IF cnt >= 30 THEN RAISE EXCEPTION 'limit_reached'; END IF;
  INSERT INTO public.custom_emojis(owner_id, shortcode, image_url) VALUES (uid, sc, p_image_url);
  RETURN jsonb_build_object('ok', true, 'shortcode', sc);
END $$;

CREATE OR REPLACE FUNCTION public.app_delete_custom_emoji(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.custom_emojis WHERE id = p_id AND owner_id = uid;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.app_unread_notifications_count()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.notifications n
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notification_reads r
       WHERE r.notification_id = n.id AND r.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.app_mark_notifications_read()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.notification_reads(notification_id, user_id)
    SELECT n.id, uid FROM public.notifications n
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.app_set_app_background(p_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET app_background_url = NULLIF(p_url, '') WHERE id = uid;
  RETURN jsonb_build_object('ok', true);
END $$;
