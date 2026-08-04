ALTER TABLE public.partnership_members
  ADD CONSTRAINT partnership_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.partnership_join_requests
  ADD CONSTRAINT partnership_join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.partnership_posts
  ADD CONSTRAINT partnership_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.partnership_tasks
  ADD CONSTRAINT partnership_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.partnership_log
  ADD CONSTRAINT partnership_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.partnership_finance
  ADD CONSTRAINT partnership_finance_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.partnership_documents
  ADD CONSTRAINT partnership_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.posts
  ADD COLUMN partnership_id uuid REFERENCES public.partnerships(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS posts_insert_author ON public.posts;
CREATE POLICY posts_insert_author ON public.posts
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_blocked = false)
  AND (
    (partnership_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_author = true))
    OR (partnership_id IS NOT NULL AND public.is_partner_member(partnership_id, auth.uid()))
  )
);