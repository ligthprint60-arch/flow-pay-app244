
REVOKE EXECUTE ON FUNCTION public.app_p2p_transfer(text, bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.app_purchase_customization(text, text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.app_p2p_transfer(text, bigint, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.app_purchase_customization(text, text, integer) TO authenticated;
