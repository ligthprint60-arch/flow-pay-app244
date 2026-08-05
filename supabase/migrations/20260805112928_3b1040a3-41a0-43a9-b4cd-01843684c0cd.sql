
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumb_url text,
  duration integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'general',
  views bigint NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos readable" ON public.videos FOR SELECT TO authenticated USING (is_published OR author_id = auth.uid());
CREATE POLICY "videos insert own" ON public.videos FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "videos update own" ON public.videos FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "videos delete own" ON public.videos FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.video_likes (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable" ON public.video_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes own" ON public.video_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes delete own" ON public.video_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vcomments readable" ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "vcomments insert own" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "vcomments delete own" ON public.video_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.channel_subscriptions (
  channel_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, subscriber_id)
);
GRANT SELECT, INSERT, DELETE ON public.channel_subscriptions TO authenticated;
GRANT ALL ON public.channel_subscriptions TO service_role;
ALTER TABLE public.channel_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs readable" ON public.channel_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "subs insert own" ON public.channel_subscriptions FOR INSERT TO authenticated WITH CHECK (subscriber_id = auth.uid());
CREATE POLICY "subs delete own" ON public.channel_subscriptions FOR DELETE TO authenticated USING (subscriber_id = auth.uid());

CREATE INDEX videos_author_idx ON public.videos(author_id);
CREATE INDEX videos_created_idx ON public.videos(created_at DESC);
CREATE INDEX video_comments_video_idx ON public.video_comments(video_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.app_video_view(p_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos SET views = views + 1 WHERE id = p_video_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.app_video_toggle_like(p_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_liked boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.video_likes WHERE video_id = p_video_id AND user_id = v_uid) THEN
    DELETE FROM public.video_likes WHERE video_id = p_video_id AND user_id = v_uid;
    UPDATE public.videos SET likes = GREATEST(0, likes - 1) WHERE id = p_video_id;
    v_liked := false;
  ELSE
    INSERT INTO public.video_likes(video_id, user_id) VALUES (p_video_id, v_uid);
    UPDATE public.videos SET likes = likes + 1 WHERE id = p_video_id;
    v_liked := true;
  END IF;
  RETURN jsonb_build_object('liked', v_liked);
END; $$;

CREATE OR REPLACE FUNCTION public.app_toggle_subscription(p_channel_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_sub boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_channel_id = v_uid THEN RAISE EXCEPTION 'cannot subscribe to yourself'; END IF;
  IF EXISTS (SELECT 1 FROM public.channel_subscriptions WHERE channel_id = p_channel_id AND subscriber_id = v_uid) THEN
    DELETE FROM public.channel_subscriptions WHERE channel_id = p_channel_id AND subscriber_id = v_uid;
    v_sub := false;
  ELSE
    INSERT INTO public.channel_subscriptions(channel_id, subscriber_id) VALUES (p_channel_id, v_uid);
    v_sub := true;
  END IF;
  RETURN jsonb_build_object('subscribed', v_sub);
END; $$;

REVOKE EXECUTE ON FUNCTION public.app_video_view(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_video_toggle_like(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_toggle_subscription(uuid) FROM anon;
