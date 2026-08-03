CREATE OR REPLACE FUNCTION public.app_create_partnership(p_name text, p_description text, p_goals text, p_field text, p_language text, p_is_open boolean, p_decision_rule text, p_revenue_model text, p_logo_url text, p_full_name text, p_signature text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE uid uuid := auth.uid(); nm text; sl text; pid uuid; aid uuid; body text; em text; blocked boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT is_blocked INTO blocked FROM public.profiles WHERE id = uid;
  IF COALESCE(blocked,false) THEN RAISE EXCEPTION 'blocked'; END IF;
  nm := left(trim(coalesce(p_name,'')), 80);
  IF length(nm) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN RAISE EXCEPTION 'invalid_full_name'; END IF;
  sl := trim(both '-' from lower(regexp_replace(nm, '[^a-zA-Z0-9]+', '-', 'g')));
  IF length(sl) < 3 THEN sl := 'p-' || substr(gen_random_uuid()::text,1,6); END IF;
  IF EXISTS(SELECT 1 FROM public.partnerships WHERE slug = sl) THEN
    sl := sl || '-' || substr(gen_random_uuid()::text,1,4);
  END IF;

  INSERT INTO public.partnerships(slug, name, logo_url, description, goals, field, language,
      is_open, decision_rule, revenue_model, created_by)
    VALUES (sl, nm, NULLIF(p_logo_url,''), left(coalesce(p_description,''),2000),
      left(coalesce(p_goals,''),1000), COALESCE(NULLIF(p_field,''),'general'),
      COALESCE(NULLIF(p_language,''),'ru'), COALESCE(p_is_open,true),
      COALESCE(NULLIF(p_decision_rule,''),'majority'), COALESCE(NULLIF(p_revenue_model,''),'equal'), uid)
    RETURNING id INTO pid;

  INSERT INTO public.partnership_members(partnership_id, user_id, role, share)
    VALUES (pid, uid, 'founder', 100);

  body := 'ЦИФРОВОЕ СОГЛАШЕНИЕ О ПАРТНЁРСТВЕ' || E'\n\n' ||
          'Название: ' || nm || E'\n' ||
          'Направление: ' || COALESCE(NULLIF(p_field,''),'general') || E'\n' ||
          'Правила принятия решений: ' || COALESCE(NULLIF(p_decision_rule,''),'majority') || E'\n' ||
          'Модель распределения доходов: ' || COALESCE(NULLIF(p_revenue_model,''),'equal') || E'\n' ||
          'Участие: ' || CASE WHEN COALESCE(p_is_open,true) THEN 'открытое' ELSE 'закрытое' END || E'\n\n' ||
          'Цели: ' || COALESCE(p_goals,'—');

  INSERT INTO public.partnership_agreements(partnership_id, version, doc_number, body, content_hash, created_by)
    VALUES (pid, 1, 'PAS-' || upper(substr(replace(pid::text,'-',''),1,10)), body,
            encode(extensions.digest(body, 'sha256'), 'hex'), uid)
    RETURNING id INTO aid;

  SELECT email INTO em FROM auth.users WHERE id = uid;
  INSERT INTO public.partnership_signatures(agreement_id, user_id, full_name, email, signature_data)
    VALUES (aid, uid, left(trim(p_full_name),120), COALESCE(em,''), NULLIF(p_signature,''));

  INSERT INTO public.partnership_log(partnership_id, actor_id, action, details)
    VALUES (pid, uid, 'partnership_created', 'Партнёрство создано и соглашение подписано');

  RETURN jsonb_build_object('ok', true, 'id', pid, 'slug', sl, 'agreement_id', aid);
END $function$;

CREATE OR REPLACE FUNCTION public.app_invite_partner(p_id uuid, p_username text, p_role text DEFAULT 'member')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); target uuid; uname text; rl text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_partner_admin(p_id, uid) THEN RAISE EXCEPTION 'not_admin'; END IF;
  uname := lower(trim(both '@' from coalesce(p_username,'')));
  IF length(uname) < 2 THEN RAISE EXCEPTION 'invalid_username'; END IF;
  SELECT id, username INTO target, uname FROM public.profiles WHERE lower(username) = uname;
  IF target IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF EXISTS(SELECT 1 FROM public.partnership_members WHERE partnership_id = p_id AND user_id = target) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  rl := CASE WHEN p_role IN ('member','admin') THEN p_role ELSE 'member' END;
  INSERT INTO public.partnership_members(partnership_id, user_id, role, share, status)
    VALUES (p_id, target, rl, 0, 'active');
  INSERT INTO public.partnership_log(partnership_id, actor_id, action, details)
    VALUES (p_id, uid, 'member_invited', 'Приглашён участник @' || uname);
  INSERT INTO public.notifications(title, body, kind, created_by)
    VALUES ('Приглашение в партнёрство',
            'Вас добавили в партнёрство: ' || (SELECT name FROM public.partnerships WHERE id = p_id),
            'info', uid);
  RETURN jsonb_build_object('ok', true, 'user_id', target);
END $function$;

REVOKE EXECUTE ON FUNCTION public.app_invite_partner(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.app_invite_partner(uuid, text, text) TO authenticated;