REVOKE ALL ON FUNCTION public.app_open_chat(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_open_chat(text) TO authenticated;

REVOKE ALL ON FUNCTION public.app_list_mini_apps(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_list_mini_apps(text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.app_ecosystem_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_ecosystem_grant(uuid) TO authenticated;