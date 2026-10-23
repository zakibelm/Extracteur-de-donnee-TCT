-- Additive migration: no tables or existing documents are deleted.
-- Requires tct_documents, tct_tournees, tct_history and users from the existing schema.
BEGIN;

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
CREATE OR REPLACE FUNCTION public.save_tct_extraction(
    p_request_id UUID, p_filename TEXT, p_upload_date TIMESTAMPTZ, p_tournees JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_document_id BIGINT;
    v_count INTEGER;
    v_row JSONB;
    v_key TEXT;
    v_keys TEXT[] := ARRAY['tournee','nom','deb_tour','fin_tour','cl_veh','employe',
        'nom_employe','employe_confirm','vehicule','cl_veh_aff','autoris','approuve',
        'retour','adresse_debut','adresse_fin'];
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF COALESCE(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' THEN
        RAISE EXCEPTION 'Administrator required';
    END IF;
    IF p_request_id IS NULL OR p_filename IS NULL OR length(p_filename) NOT BETWEEN 1 AND 255
       OR p_upload_date IS NULL OR jsonb_typeof(p_tournees) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid extraction payload';
    END IF;
    v_count := jsonb_array_length(p_tournees);
    IF v_count NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid row count'; END IF;
    FOR v_row IN SELECT value FROM jsonb_array_elements(p_tournees) LOOP
        IF jsonb_typeof(v_row) <> 'object' OR NOT (v_row ?& v_keys) THEN
            RAISE EXCEPTION 'All 15 fields are required';
        END IF;
        FOREACH v_key IN ARRAY v_keys LOOP
            IF jsonb_typeof(v_row->v_key) <> 'string' THEN RAISE EXCEPTION 'Invalid cell type'; END IF;
        END LOOP;
    END LOOP;

    INSERT INTO public.tct_documents (filename, upload_date, status, user_id, extracted_count, request_id)
    VALUES (p_filename, p_upload_date, 'success', auth.uid(), v_count, p_request_id)
    ON CONFLICT (user_id, request_id) DO NOTHING RETURNING id INTO v_document_id;

    -- A timeout/retry must not duplicate a previously committed extraction.
    IF v_document_id IS NULL THEN
        SELECT id, extracted_count INTO v_document_id, v_count FROM public.tct_documents
        WHERE user_id::text = auth.uid()::text AND request_id = p_request_id;
        RETURN jsonb_build_object('success', true, 'documentId', v_document_id,
            'tourneesCount', v_count, 'executionTime', 0);
    END IF;

    INSERT INTO public.tct_tournees (document_id, tournee, nom, deb_tour, fin_tour, cl_veh,
        employe, nom_employe, employe_confirm, vehicule, cl_veh_aff, autoris, approuve,
        retour, adresse_debut, adresse_fin)
    SELECT v_document_id, r.tournee, r.nom, r.deb_tour, r.fin_tour, r.cl_veh,
        r.employe, r.nom_employe, r.employe_confirm, r.vehicule, r.cl_veh_aff,
        r.autoris, r.approuve, r.retour, r.adresse_debut, r.adresse_fin
    FROM jsonb_to_recordset(p_tournees) AS r(tournee TEXT, nom TEXT, deb_tour TEXT,
        fin_tour TEXT, cl_veh TEXT, employe TEXT, nom_employe TEXT, employe_confirm TEXT,
        vehicule TEXT, cl_veh_aff TEXT, autoris TEXT, approuve TEXT, retour TEXT,
        adresse_debut TEXT, adresse_fin TEXT);

    INSERT INTO public.tct_history (document_id, action, status, message)
    VALUES (v_document_id, 'extraction_saved', 'success', v_count || ' tournées sauvegardées');
    RETURN jsonb_build_object('success', true, 'documentId', v_document_id,
        'tourneesCount', v_count, 'executionTime', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB) TO authenticated;
COMMIT;
