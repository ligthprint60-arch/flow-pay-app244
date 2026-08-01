
-- ===== PARTNERSHIPS =====
CREATE TABLE public.partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  description text,
  goals text,
  field text NOT NULL DEFAULT 'general',
  language text NOT NULL DEFAULT 'ru',
  is_open boolean NOT NULL DEFAULT true,
  decision_rule text NOT NULL DEFAULT 'majority',
  revenue_model text NOT NULL DEFAULT 'equal',
  contacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  reputation integer NOT NULL DEFAULT 0,
  followers_count integer NOT NULL DEFAULT 0,
  founded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.partnerships TO authenticated;
GRANT ALL ON public.partnerships TO service_role;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.partnership_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  share numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_members TO authenticated;
GRANT ALL ON public.partnership_members TO service_role;
ALTER TABLE public.partnership_members ENABLE ROW LEVEL SECURITY;

-- helper functions (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_partner_member(_pid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.partnership_members m
    WHERE m.partnership_id = _pid AND m.user_id = _uid AND m.status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_partner_admin(_pid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.partnership_members m
    WHERE m.partnership_id = _pid AND m.user_id = _uid AND m.status = 'active'
      AND m.role IN ('founder','admin'));
$$;

CREATE POLICY p_read_all ON public.partnerships FOR SELECT TO authenticated USING (true);
CREATE POLICY p_insert_own ON public.partnerships FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY p_update_admin ON public.partnerships FOR UPDATE TO authenticated
  USING (public.is_partner_admin(id, auth.uid())) WITH CHECK (public.is_partner_admin(id, auth.uid()));

CREATE POLICY pm_read ON public.partnership_members FOR SELECT TO authenticated USING (true);
CREATE POLICY pm_insert ON public.partnership_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_partner_admin(partnership_id, auth.uid()));
CREATE POLICY pm_update ON public.partnership_members FOR UPDATE TO authenticated
  USING (public.is_partner_admin(partnership_id, auth.uid()));
CREATE POLICY pm_delete ON public.partnership_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_partner_admin(partnership_id, auth.uid()));

-- ===== JOIN REQUESTS =====
CREATE TABLE public.partnership_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_join_requests TO authenticated;
GRANT ALL ON public.partnership_join_requests TO service_role;
ALTER TABLE public.partnership_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY pjr_read ON public.partnership_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_partner_admin(partnership_id, auth.uid()));
CREATE POLICY pjr_insert ON public.partnership_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY pjr_update ON public.partnership_join_requests FOR UPDATE TO authenticated
  USING (public.is_partner_admin(partnership_id, auth.uid()));
CREATE POLICY pjr_delete ON public.partnership_join_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_partner_admin(partnership_id, auth.uid()));

-- ===== AGREEMENTS & SIGNATURES =====
CREATE TABLE public.partnership_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  doc_number text NOT NULL,
  body text NOT NULL,
  content_hash text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.partnership_agreements TO authenticated;
GRANT ALL ON public.partnership_agreements TO service_role;
ALTER TABLE public.partnership_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY pa_read ON public.partnership_agreements FOR SELECT TO authenticated USING (true);
CREATE POLICY pa_insert ON public.partnership_agreements FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE TABLE public.partnership_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.partnership_agreements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  signature_data text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, user_id)
);
GRANT SELECT, INSERT ON public.partnership_signatures TO authenticated;
GRANT ALL ON public.partnership_signatures TO service_role;
ALTER TABLE public.partnership_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_read ON public.partnership_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY ps_insert ON public.partnership_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===== POSTS / FOLLOWERS =====
CREATE TABLE public.partnership_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  media_url text,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.partnership_posts TO authenticated;
GRANT ALL ON public.partnership_posts TO service_role;
ALTER TABLE public.partnership_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_read ON public.partnership_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY pp_insert ON public.partnership_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pp_delete ON public.partnership_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_partner_admin(partnership_id, auth.uid()));

CREATE TABLE public.partnership_followers (
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partnership_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.partnership_followers TO authenticated;
GRANT ALL ON public.partnership_followers TO service_role;
ALTER TABLE public.partnership_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY pf_read ON public.partnership_followers FOR SELECT TO authenticated USING (true);
CREATE POLICY pf_write ON public.partnership_followers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY pf_delete ON public.partnership_followers FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===== PROJECTS / TASKS =====
CREATE TABLE public.partnership_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_projects TO authenticated;
GRANT ALL ON public.partnership_projects TO service_role;
ALTER TABLE public.partnership_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppr_read ON public.partnership_projects FOR SELECT TO authenticated
  USING (is_public OR public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY ppr_write ON public.partnership_projects FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY ppr_update ON public.partnership_projects FOR UPDATE TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY ppr_delete ON public.partnership_projects FOR DELETE TO authenticated
  USING (public.is_partner_admin(partnership_id, auth.uid()));

CREATE TABLE public.partnership_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.partnership_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_tasks TO authenticated;
GRANT ALL ON public.partnership_tasks TO service_role;
ALTER TABLE public.partnership_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_read ON public.partnership_tasks FOR SELECT TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pt_write ON public.partnership_tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pt_update ON public.partnership_tasks FOR UPDATE TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pt_delete ON public.partnership_tasks FOR DELETE TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));

-- ===== DOCUMENTS =====
CREATE TABLE public.partnership_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'document',
  version integer NOT NULL DEFAULT 1,
  file_url text,
  body text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_documents TO authenticated;
GRANT ALL ON public.partnership_documents TO service_role;
ALTER TABLE public.partnership_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pd_read ON public.partnership_documents FOR SELECT TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pd_write ON public.partnership_documents FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pd_update ON public.partnership_documents FOR UPDATE TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pd_delete ON public.partnership_documents FOR DELETE TO authenticated
  USING (public.is_partner_admin(partnership_id, auth.uid()));

-- ===== FINANCE =====
CREATE TABLE public.partnership_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'income',
  amount bigint NOT NULL,
  category text NOT NULL DEFAULT 'general',
  note text,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_finance TO authenticated;
GRANT ALL ON public.partnership_finance TO service_role;
ALTER TABLE public.partnership_finance ENABLE ROW LEVEL SECURITY;
CREATE POLICY pfin_read ON public.partnership_finance FOR SELECT TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pfin_write ON public.partnership_finance FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_partner_member(partnership_id, auth.uid()));
CREATE POLICY pfin_update ON public.partnership_finance FOR UPDATE TO authenticated
  USING (public.is_partner_admin(partnership_id, auth.uid()));
CREATE POLICY pfin_delete ON public.partnership_finance FOR DELETE TO authenticated
  USING (public.is_partner_admin(partnership_id, auth.uid()));

-- ===== LOG =====
CREATE TABLE public.partnership_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partnership_log TO authenticated;
GRANT ALL ON public.partnership_log TO service_role;
ALTER TABLE public.partnership_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY plog_read ON public.partnership_log FOR SELECT TO authenticated
  USING (public.is_partner_member(partnership_id, auth.uid()));

CREATE INDEX idx_pmembers_user ON public.partnership_members(user_id);
CREATE INDEX idx_pposts_pid ON public.partnership_posts(partnership_id, created_at DESC);

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.app_create_partnership(
  p_name text, p_description text, p_goals text, p_field text, p_language text,
  p_is_open boolean, p_decision_rule text, p_revenue_model text, p_logo_url text,
  p_full_name text, p_signature text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
            encode(digest(body, 'sha256'), 'hex'), uid)
    RETURNING id INTO aid;

  SELECT email INTO em FROM auth.users WHERE id = uid;
  INSERT INTO public.partnership_signatures(agreement_id, user_id, full_name, email, signature_data)
    VALUES (aid, uid, left(trim(p_full_name),120), COALESCE(em,''), NULLIF(p_signature,''));

  INSERT INTO public.partnership_log(partnership_id, actor_id, action, details)
    VALUES (pid, uid, 'partnership_created', 'Партнёрство создано и соглашение подписано');

  RETURN jsonb_build_object('ok', true, 'id', pid, 'slug', sl, 'agreement_id', aid);
END $$;

CREATE OR REPLACE FUNCTION public.app_join_partnership(p_id uuid, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_open boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT p.is_open INTO is_open FROM public.partnerships p WHERE p.id = p_id;
  IF is_open IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF public.is_partner_member(p_id, uid) THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;
  IF is_open THEN
    INSERT INTO public.partnership_members(partnership_id, user_id, role) VALUES (p_id, uid, 'member')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.partnership_log(partnership_id, actor_id, action) VALUES (p_id, uid, 'member_joined');
    RETURN jsonb_build_object('ok', true, 'joined', true);
  ELSE
    INSERT INTO public.partnership_join_requests(partnership_id, user_id, message)
      VALUES (p_id, uid, left(coalesce(p_message,''),500))
      ON CONFLICT (partnership_id, user_id) DO UPDATE SET status='pending', message=EXCLUDED.message;
    RETURN jsonb_build_object('ok', true, 'requested', true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.app_review_join_request(p_request_id uuid, p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r record;
BEGIN
  SELECT * INTO r FROM public.partnership_join_requests WHERE id = p_request_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_partner_admin(r.partnership_id, uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.partnership_join_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
    WHERE id = p_request_id;
  IF p_approve THEN
    INSERT INTO public.partnership_members(partnership_id, user_id, role) VALUES (r.partnership_id, r.user_id, 'member')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.partnership_log(partnership_id, actor_id, action) VALUES (r.partnership_id, uid, 'member_approved');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.app_toggle_follow_partnership(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); existed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.partnership_followers WHERE partnership_id=p_id AND user_id=uid) INTO existed;
  IF existed THEN
    DELETE FROM public.partnership_followers WHERE partnership_id=p_id AND user_id=uid;
    UPDATE public.partnerships SET followers_count = GREATEST(0, followers_count-1) WHERE id=p_id;
  ELSE
    INSERT INTO public.partnership_followers(partnership_id, user_id) VALUES (p_id, uid);
    UPDATE public.partnerships SET followers_count = followers_count+1, reputation = reputation+1 WHERE id=p_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'following', NOT existed);
END $$;

CREATE OR REPLACE FUNCTION public.app_list_partnerships(p_search text DEFAULT NULL, p_only_mine boolean DEFAULT false)
RETURNS TABLE(id uuid, slug text, name text, logo_url text, description text, field text,
  is_open boolean, reputation integer, followers_count integer, members_count bigint,
  founded_at timestamptz, my_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT p.id, p.slug, p.name, p.logo_url, p.description, p.field, p.is_open,
         p.reputation, p.followers_count,
         (SELECT count(*) FROM public.partnership_members m WHERE m.partnership_id = p.id AND m.status='active'),
         p.founded_at,
         (SELECT m2.role FROM public.partnership_members m2 WHERE m2.partnership_id = p.id AND m2.user_id = uid)
    FROM public.partnerships p
   WHERE (p_search IS NULL OR p.name ILIKE '%'||p_search||'%' OR p.description ILIKE '%'||p_search||'%')
     AND (NOT p_only_mine OR EXISTS(SELECT 1 FROM public.partnership_members m3
            WHERE m3.partnership_id=p.id AND m3.user_id=uid AND m3.status='active'))
   ORDER BY p.reputation DESC, p.created_at DESC
   LIMIT 200;
END $$;

REVOKE EXECUTE ON FUNCTION public.app_create_partnership(text,text,text,text,text,boolean,text,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_join_partnership(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_review_join_request(uuid,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_toggle_follow_partnership(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_list_partnerships(text,boolean) FROM anon;
