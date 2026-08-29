-- Admin RLS policies call this helper for every admin-only read and write.
-- Keep execution limited to authenticated users; the function itself checks
-- the caller's profile role under SECURITY DEFINER.
grant execute on function public.is_admin() to authenticated;

notify pgrst, 'reload schema';
