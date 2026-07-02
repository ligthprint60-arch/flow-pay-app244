
-- ============ mini_apps ============
CREATE TABLE public.mini_apps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tagline text,
  description text,
  icon_url text,
  app_url text NOT NULL,
  category text NOT NULL DEFAULT 'utilities',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reject_reason text,
  installs bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mini_apps TO authenticated;
GRANT SELECT ON public.mini_apps TO anon;
GRANT ALL ON public.mini_apps TO service_role;

ALTER TABLE public.mini_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads approved apps"
  ON public.mini_apps FOR SELECT
  USING (status = 'approved' OR owner_id = auth.uid());

CREATE POLICY "owner updates own draft"
  ON public.mini_apps FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============ mini_app_permissions ============
CREATE TABLE public.mini_app_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  app_id uuid NOT NULL REFERENCES public.mini_apps(id) ON DELETE CASCADE,
  wallet_access boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, app_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mini_app_permissions TO authenticated;
GRANT ALL ON public.mini_app_permissions TO service_role;

ALTER TABLE public.mini_app_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own permissions"
  ON public.mini_app_permissions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============ submit ============
CREATE OR REPLACE FUNCTION public.app_submit_mini_app(
  p_name text, p_slug text, p_tagline text, p_description text,
  p_icon_url text, p_app_url text, p_category text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); sc text; nid uuid; blocked boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT is_blocked INTO blocked FROM public.profiles WHERE id = uid;
  IF blocked THEN RAISE EXCEPTION 'blocked'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF p_app_url IS NULL OR p_app_url !~ '^https?://' THEN RAISE EXCEPTION 'invalid_url'; END IF;
  sc := lower(regexp_replace(coalesce(p_slug, p_name), '[^a-z0-9-]+', '-', 'g'));
  sc := trim(both '-' from sc);
  IF length(sc) < 3 THEN RAISE EXCEPTION 'invalid_slug'; END IF;
  IF EXISTS(SELECT 1 FROM public.mini_apps WHERE slug = sc) THEN
    sc := sc || '-' || substr(gen_random_uuid()::text, 1, 4);
  END IF;

  INSERT INTO public.mini_apps(owner_id, name, slug, tagline, description, icon_url, app_url, category, status)
    VALUES (uid, left(p_name, 60), sc, left(coalesce(p_tagline,''), 120),
            left(coalesce(p_description,''), 2000), NULLIF(p_icon_url,''),
            p_app_url, COALESCE(NULLIF(p_category,''), 'utilities'), 'pending')
    RETURNING id INTO nid;
  RETURN jsonb_build_object('ok', true, 'id', nid, 'slug', sc);
END $$;

-- ============ list ============
CREATE OR REPLACE FUNCTION public.app_list_mini_apps(
  p_category text DEFAULT NULL, p_search text DEFAULT NULL, p_only_mine boolean DEFAULT false
) RETURNS TABLE(
  id uuid, owner_id uuid, owner_username text, name text, slug text, tagline text,
  description text, icon_url text, app_url text, category text, status text, installs bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  RETURN QUERY
    SELECT a.id, a.owner_id, p.username, a.name, a.slug, a.tagline,
           a.description, a.icon_url, a.app_url, a.category, a.status, a.installs
      FROM public.mini_apps a
      LEFT JOIN public.profiles p ON p.id = a.owner_id
     WHERE (p_only_mine = false OR a.owner_id = uid)
       AND (p_only_mine = true OR a.status = 'approved')
       AND (p_category IS NULL OR a.category = p_category)
       AND (p_search IS NULL OR a.name ILIKE '%'||p_search||'%' OR a.tagline ILIKE '%'||p_search||'%')
     ORDER BY a.installs DESC, a.created_at DESC
     LIMIT 200;
END $$;

-- ============ moderate ============
CREATE OR REPLACE FUNCTION public.app_admin_moderate_mini_app(
  p_id uuid, p_action text, p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_action NOT IN ('approve','reject','pending') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  UPDATE public.mini_apps
     SET status = CASE p_action WHEN 'approve' THEN 'approved'
                                 WHEN 'reject'  THEN 'rejected'
                                 ELSE 'pending' END,
         reject_reason = CASE WHEN p_action = 'reject' THEN p_reason ELSE NULL END,
         updated_at = now()
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============ grant / revoke ============
CREATE OR REPLACE FUNCTION public.app_ecosystem_grant(p_app_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); st text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT status INTO st FROM public.mini_apps WHERE id = p_app_id;
  IF st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF st <> 'approved' THEN RAISE EXCEPTION 'not_approved'; END IF;
  INSERT INTO public.mini_app_permissions(user_id, app_id, wallet_access)
    VALUES (uid, p_app_id, true)
    ON CONFLICT (user_id, app_id) DO UPDATE SET wallet_access = true, granted_at = now();
  UPDATE public.mini_apps SET installs = installs + 1 WHERE id = p_app_id
    AND NOT EXISTS (SELECT 1 FROM public.mini_app_permissions WHERE user_id = uid AND app_id = p_app_id);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.app_ecosystem_revoke(p_app_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.mini_app_permissions WHERE user_id = uid AND app_id = p_app_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============ charge ============
CREATE OR REPLACE FUNCTION public.app_ecosystem_charge(
  p_app_id uuid, p_amount bigint, p_memo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); allowed boolean; w record; app_name text; owner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT wallet_access INTO allowed FROM public.mini_app_permissions
    WHERE user_id = uid AND app_id = p_app_id;
  IF NOT COALESCE(allowed, false) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT name, owner_id INTO app_name, owner FROM public.mini_apps WHERE id = p_app_id AND status = 'approved';
  IF app_name IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF w.fflow_active < p_amount THEN RAISE EXCEPTION 'insufficient_fflow'; END IF;

  UPDATE public.wallets SET fflow_active = fflow_active - p_amount, updated_at = now() WHERE user_id = uid;
  -- 70% автору приложения, 30% сгорает
  UPDATE public.wallets SET fflow_active = fflow_active + FLOOR(p_amount * 0.7)::bigint, updated_at = now()
    WHERE user_id = owner;

  INSERT INTO public.transactions(user_id, type, fflow_active_delta, counterparty, note)
    VALUES (uid, 'donation', -p_amount, 'Mini-app: '||app_name, COALESCE(p_memo, 'Оплата в мини-приложении'));
  RETURN jsonb_build_object('ok', true, 'charged', p_amount);
END $$;

-- ============ context ============
CREATE OR REPLACE FUNCTION public.app_ecosystem_get_context(p_app_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); p record; w record; allowed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT username, display_name INTO p FROM public.profiles WHERE id = uid;
  SELECT wallet_access INTO allowed FROM public.mini_app_permissions
    WHERE user_id = uid AND app_id = p_app_id;
  SELECT fflow_active INTO w FROM public.wallets WHERE user_id = uid;
  RETURN jsonb_build_object(
    'username', p.username, 'display_name', p.display_name,
    'wallet_access', COALESCE(allowed, false),
    'fflow_active', COALESCE(w.fflow_active, 0)
  );
END $$;
