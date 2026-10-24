-- Access restrictions used after bootstrap.sql on an empty database.
-- Additive migration: no tables or existing documents are deleted.
-- Requires tct_documents, tct_tournees, tct_history and users from the existing schema.


-- User-editable metadata must never grant administrator privileges.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, num_dome, id_employe, email, telephone, role, is_admin)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'numDome', NEW.id::text),
        COALESCE(NEW.raw_user_meta_data->>'employeeId', ''), NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'telephone', ''), 'driver', false);
    RETURN NEW;
END;
$$;

-- Lock all role changes through direct profile writes. App roles are managed
-- exclusively with Supabase Admin API app_metadata (never user_metadata).
CREATE OR REPLACE FUNCTION public.protect_user_privileges()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') AND
       (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
        RAISE EXCEPTION 'Profile privilege changes are not allowed';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_user_privileges ON public.users;
CREATE TRIGGER protect_user_privileges BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileges();
REVOKE INSERT, DELETE, UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (num_dome, id_employe, telephone) ON public.users TO authenticated;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Admins can view all profiles" ON public.users FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

ALTER TABLE public.tct_documents ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS tct_documents_request_user_idx
ON public.tct_documents (user_id, request_id);

-- Identity is derived from auth.uid(), never accepted from a browser field.
-- SECURITY INVOKER preserves the existing document/row RLS checks.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove default Supabase table grants that bypass row-level checks (TRUNCATE)
-- or permit schema changes. Only the application's actual operations remain.
REVOKE ALL ON public.users, public.tct_documents, public.tct_tournees,
    public.tct_history, public.tct_documents_summary, public.tct_recent_extractions
    FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (num_dome, id_employe, telephone) ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tct_documents, public.tct_tournees,
    public.tct_history TO authenticated;
GRANT SELECT ON public.tct_documents_summary, public.tct_recent_extractions TO authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_privileges() FROM PUBLIC, anon, authenticated;

-- Explicit ownership checks on both the existing row and its new values.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own documents" ON public.tct_documents;
CREATE POLICY "Users can update their own documents" ON public.tct_documents
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
