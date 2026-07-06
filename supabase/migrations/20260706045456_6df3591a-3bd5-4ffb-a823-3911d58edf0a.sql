
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
DROP POLICY IF EXISTS wallets_insert_own ON public.wallets;
DROP POLICY IF EXISTS tx_insert_own      ON public.transactions;

REVOKE INSERT, UPDATE, DELETE ON public.wallets      FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM authenticated, anon;
GRANT  SELECT ON public.wallets      TO authenticated;
GRANT  SELECT ON public.transactions TO authenticated;
GRANT  ALL    ON public.wallets      TO service_role;
GRANT  ALL    ON public.transactions TO service_role;

REVOKE SELECT ON public.quizzes FROM authenticated, anon;
GRANT  SELECT (id, question, options, reward, active_date, created_at)
       ON public.quizzes TO authenticated;
GRANT  ALL ON public.quizzes TO service_role;

DROP POLICY IF EXISTS "owner updates own draft" ON public.mini_apps;
CREATE POLICY "owner updates own metadata"
  ON public.mini_apps FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mini_apps_lock_moderated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.status        := OLD.status;
  NEW.installs      := OLD.installs;
  NEW.reject_reason := OLD.reject_reason;
  NEW.owner_id      := OLD.owner_id;
  NEW.created_at    := OLD.created_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mini_apps_lock_moderated_trg ON public.mini_apps;
CREATE TRIGGER mini_apps_lock_moderated_trg
  BEFORE UPDATE ON public.mini_apps
  FOR EACH ROW EXECUTE FUNCTION public.mini_apps_lock_moderated();

DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'app_%' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated;', fn);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.app_qr_pay(p_amount bigint, p_merchant text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w record; reward bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_merchant IS NULL OR length(trim(p_merchant)) = 0 THEN RAISE EXCEPTION 'invalid_merchant'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF w.rflow_balance < p_amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  reward := FLOOR(p_amount * 0.02);
  UPDATE public.wallets
     SET rflow_balance = rflow_balance - p_amount,
         fflow_pending = fflow_pending + reward,
         updated_at    = now()
   WHERE user_id = uid;
  INSERT INTO public.transactions(user_id, type, rflow_delta, counterparty, note)
    VALUES (uid, 'payment', -p_amount, left(p_merchant, 60), 'Оплата QR');
  INSERT INTO public.transactions(user_id, type, fflow_pending_delta, counterparty, note)
    VALUES (uid, 'spend_reward', reward, 'FLOW', 'Cashback 2% от '||left(p_merchant,60));
  RETURN jsonb_build_object('ok', true, 'amount', p_amount, 'reward', reward);
END $$;

CREATE OR REPLACE FUNCTION public.app_fragment(p_pending bigint, p_cost bigint, p_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w record; allowed jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  allowed := jsonb_build_object('50', 25000, '150', 60000, '400', 140000, '1000', 300000);
  IF (allowed->(p_pending::text)) IS NULL OR (allowed->>(p_pending::text))::bigint <> p_cost THEN
    RAISE EXCEPTION 'invalid_tier';
  END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF w.fflow_pending < p_pending THEN RAISE EXCEPTION 'insufficient_pending'; END IF;
  IF w.rflow_balance < p_cost    THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  UPDATE public.wallets
     SET rflow_balance = rflow_balance - p_cost,
         fflow_pending = fflow_pending - p_pending,
         fflow_active  = fflow_active  + p_pending,
         updated_at    = now()
   WHERE user_id = uid;
  INSERT INTO public.transactions(user_id, type, rflow_delta, fflow_pending_delta, fflow_active_delta, counterparty, note)
    VALUES (uid, 'fragmentation', -p_cost, -p_pending, p_pending, 'FLOW Engine', 'Фрагментация '||coalesce(p_label,''));
  RETURN jsonb_build_object('ok', true, 'activated', p_pending);
END $$;

CREATE OR REPLACE FUNCTION public.app_topup_rflow(p_amount bigint, p_card_last4 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); last4 text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_amount IS NULL OR p_amount < 1000 OR p_amount > 50000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  last4 := regexp_replace(coalesce(p_card_last4, ''), '\D', '', 'g');
  IF length(last4) < 4 THEN RAISE EXCEPTION 'invalid_card'; END IF;
  last4 := right(last4, 4);
  UPDATE public.wallets
     SET rflow_balance = rflow_balance + p_amount, updated_at = now()
   WHERE user_id = uid;
  INSERT INTO public.transactions(user_id, type, rflow_delta, counterparty, note)
    VALUES (uid, 'transfer', p_amount, '•••• '||last4, 'Пополнение с карты → rFLOW');
  RETURN jsonb_build_object('ok', true, 'amount', p_amount);
END $$;

CREATE OR REPLACE FUNCTION public.app_quiz_answer(p_quiz_id uuid, p_chosen_index int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); q record; is_correct boolean; already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT correct_index, reward INTO q FROM public.quizzes WHERE id = p_quiz_id;
  IF q IS NULL THEN RAISE EXCEPTION 'quiz_not_found'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.quiz_attempts WHERE user_id = uid AND quiz_id = p_quiz_id) INTO already;
  IF already THEN RAISE EXCEPTION 'already_answered'; END IF;
  is_correct := (p_chosen_index = q.correct_index);
  INSERT INTO public.quiz_attempts(user_id, quiz_id, chosen_index, correct)
    VALUES (uid, p_quiz_id, p_chosen_index, is_correct);
  IF is_correct THEN
    UPDATE public.wallets
       SET fflow_pending = fflow_pending + q.reward, updated_at = now()
     WHERE user_id = uid;
    INSERT INTO public.transactions(user_id, type, fflow_pending_delta, counterparty, note)
      VALUES (uid, 'quiz_reward', q.reward, 'Daily Quiz', 'Правильный ответ');
  END IF;
  RETURN jsonb_build_object('ok', true, 'correct', is_correct, 'reward', CASE WHEN is_correct THEN q.reward ELSE 0 END);
END $$;

REVOKE EXECUTE ON FUNCTION public.app_qr_pay(bigint, text)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.app_fragment(bigint, bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.app_topup_rflow(bigint, text)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.app_quiz_answer(uuid, int)         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.app_qr_pay(bigint, text)           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.app_fragment(bigint, bigint, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.app_topup_rflow(bigint, text)      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.app_quiz_answer(uuid, int)         TO authenticated;
