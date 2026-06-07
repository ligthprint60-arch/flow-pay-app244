
DROP FUNCTION IF EXISTS public.app_list_chats();
CREATE FUNCTION public.app_list_chats()
 RETURNS TABLE(chat_id uuid, other_id uuid, other_username text, other_display_name text, other_is_verified boolean, other_is_author boolean, other_avatar_url text, last_message_at timestamp with time zone, last_body text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT c.id,
         p.id, p.username, p.display_name, p.is_verified, p.is_author, p.avatar_url,
         c.last_message_at,
         (SELECT m.body FROM public.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1)
    FROM public.chats c
    JOIN public.profiles p ON p.id = CASE WHEN c.user_a = uid THEN c.user_b ELSE c.user_a END
   WHERE c.user_a = uid OR c.user_b = uid
   ORDER BY c.last_message_at DESC
   LIMIT 100;
END;
$function$;
