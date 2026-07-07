
-- packs
CREATE TABLE public.emoji_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emoji_packs TO authenticated;
GRANT ALL ON public.emoji_packs TO service_role;
ALTER TABLE public.emoji_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_read_all" ON public.emoji_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ep_owner_write" ON public.emoji_packs FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ep_owner_update" ON public.emoji_packs FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "ep_owner_delete" ON public.emoji_packs FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- link emojis to packs (optional)
ALTER TABLE public.custom_emojis ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.emoji_packs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS custom_emojis_pack_id_idx ON public.custom_emojis(pack_id);

-- profile featured emoji (shortcode or image url)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS featured_emoji text;

-- create pack (premium only)
CREATE OR REPLACE FUNCTION public.app_create_emoji_pack(p_name text, p_cover_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_premium boolean; nm text; nid uuid; cnt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT (premium_until IS NOT NULL AND premium_until > now()) INTO is_premium FROM public.profiles WHERE id = uid;
  IF NOT is_premium THEN RAISE EXCEPTION 'premium_required'; END IF;
  nm := left(trim(coalesce(p_name,'')), 40);
  IF length(nm) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  SELECT count(*) INTO cnt FROM public.emoji_packs WHERE owner_id = uid;
  IF cnt >= 20 THEN RAISE EXCEPTION 'limit_reached'; END IF;
  INSERT INTO public.emoji_packs(owner_id, name, cover_url)
    VALUES (uid, nm, NULLIF(p_cover_url,'')) RETURNING id INTO nid;
  RETURN jsonb_build_object('ok', true, 'id', nid);
END $$;

CREATE OR REPLACE FUNCTION public.app_delete_emoji_pack(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.emoji_packs WHERE id = p_id AND owner_id = uid;
  RETURN jsonb_build_object('ok', true);
END $$;

-- create emoji inside pack (premium only), replaces standalone with pack link
CREATE OR REPLACE FUNCTION public.app_add_emoji_to_pack(p_pack_id uuid, p_shortcode text, p_image_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_premium boolean; sc text; owns boolean; cnt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT (premium_until IS NOT NULL AND premium_until > now()) INTO is_premium FROM public.profiles WHERE id = uid;
  IF NOT is_premium THEN RAISE EXCEPTION 'premium_required'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.emoji_packs WHERE id = p_pack_id AND owner_id = uid) INTO owns;
  IF NOT owns THEN RAISE EXCEPTION 'pack_not_found'; END IF;
  sc := lower(regexp_replace(coalesce(p_shortcode,''), '[^a-z0-9_]', '', 'g'));
  IF length(sc) < 2 OR length(sc) > 24 THEN RAISE EXCEPTION 'invalid_shortcode'; END IF;
  IF p_image_url IS NULL OR length(p_image_url) < 5 THEN RAISE EXCEPTION 'invalid_image'; END IF;
  SELECT count(*) INTO cnt FROM public.custom_emojis WHERE pack_id = p_pack_id;
  IF cnt >= 50 THEN RAISE EXCEPTION 'pack_full'; END IF;
  INSERT INTO public.custom_emojis(owner_id, shortcode, image_url, pack_id)
    VALUES (uid, sc, p_image_url, p_pack_id);
  RETURN jsonb_build_object('ok', true, 'shortcode', sc);
END $$;

CREATE OR REPLACE FUNCTION public.app_set_featured_emoji(p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET featured_emoji = NULLIF(left(coalesce(p_value,''), 64), '') WHERE id = uid;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.app_create_emoji_pack(text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_delete_emoji_pack(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_add_emoji_to_pack(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_set_featured_emoji(text) FROM anon;
