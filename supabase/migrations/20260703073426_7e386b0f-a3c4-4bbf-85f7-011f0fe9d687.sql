CREATE OR REPLACE FUNCTION public.app_open_chat(other_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  normalized_username text;
  other_id uuid;
  other_blocked boolean;
  sender_blocked boolean;
  ua uuid;
  ub uuid;
  chat_row record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  normalized_username := lower(regexp_replace(trim(coalesce(other_username, '')), '^@+', ''));
  IF length(normalized_username) < 3 THEN RAISE EXCEPTION 'invalid_username'; END IF;

  SELECT is_blocked INTO sender_blocked FROM public.profiles WHERE id = uid;
  IF COALESCE(sender_blocked, false) THEN RAISE EXCEPTION 'sender_blocked'; END IF;

  SELECT id, is_blocked INTO other_id, other_blocked
    FROM public.profiles
   WHERE lower(username) = normalized_username
   LIMIT 1;

  IF other_id IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF COALESCE(other_blocked, false) THEN RAISE EXCEPTION 'recipient_blocked'; END IF;
  IF other_id = uid THEN RAISE EXCEPTION 'self_chat_forbidden'; END IF;

  IF uid < other_id THEN
    ua := uid;
    ub := other_id;
  ELSE
    ua := other_id;
    ub := uid;
  END IF;

  SELECT * INTO chat_row
    FROM public.chats
   WHERE user_a = ua AND user_b = ub
   LIMIT 1;

  IF chat_row.id IS NULL THEN
    INSERT INTO public.chats(user_a, user_b)
    VALUES (ua, ub)
    RETURNING * INTO chat_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'chat_id', chat_row.id, 'other_id', other_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_list_mini_apps(
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_only_mine boolean DEFAULT false
) RETURNS TABLE(
  id uuid,
  owner_id uuid,
  owner_username text,
  name text,
  slug text,
  tagline text,
  description text,
  icon_url text,
  app_url text,
  category text,
  status text,
  installs bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin boolean := public.is_admin(auth.uid());
BEGIN
  RETURN QUERY
    SELECT a.id, a.owner_id, p.username, a.name, a.slug, a.tagline,
           a.description, a.icon_url, a.app_url, a.category, a.status, a.installs
      FROM public.mini_apps a
      LEFT JOIN public.profiles p ON p.id = a.owner_id
     WHERE (NOT p_only_mine OR a.owner_id = uid)
       AND (admin OR p_only_mine OR a.status = 'approved')
       AND (p_category IS NULL OR a.category = p_category)
       AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%' OR a.tagline ILIKE '%' || p_search || '%' OR p.username ILIKE '%' || p_search || '%')
     ORDER BY
       CASE a.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
       a.installs DESC,
       a.created_at DESC
     LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_ecosystem_grant(p_app_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  st text;
  existed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT status INTO st FROM public.mini_apps WHERE id = p_app_id;
  IF st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF st <> 'approved' THEN RAISE EXCEPTION 'not_approved'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.mini_app_permissions
     WHERE user_id = uid AND app_id = p_app_id
  ) INTO existed;

  INSERT INTO public.mini_app_permissions(user_id, app_id, wallet_access)
  VALUES (uid, p_app_id, true)
  ON CONFLICT (user_id, app_id)
  DO UPDATE SET wallet_access = true, granted_at = now();

  IF NOT existed THEN
    UPDATE public.mini_apps
       SET installs = installs + 1,
           updated_at = now()
     WHERE id = p_app_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'first_install', NOT existed);
END;
$$;