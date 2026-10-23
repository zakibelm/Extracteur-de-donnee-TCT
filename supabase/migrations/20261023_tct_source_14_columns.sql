-- Additive upgrade to the 14-column real TCT source format. No historical data is removed.
BEGIN;
ALTER TABLE public.tct_documents ADD COLUMN IF NOT EXISTS schedule_date DATE;
ALTER TABLE public.tct_documents ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.tct_tournees ADD COLUMN IF NOT EXISTS stationnement VARCHAR(100);
ALTER TABLE public.tct_tournees ADD COLUMN IF NOT EXISTS territoire_debut VARCHAR(100);
-- The obsolete signature is removed to avoid ambiguous calls; existing tables/rows stay intact.
DROP FUNCTION IF EXISTS public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB);
CREATE OR REPLACE FUNCTION public.save_tct_extraction(
    p_request_id UUID, p_filename TEXT, p_upload_date TIMESTAMPTZ, p_tournees JSONB, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_document_id BIGINT;
    v_count INTEGER;
    v_row JSONB;
    v_key TEXT;
    v_keys TEXT[] := ARRAY['tournee','nom','deb_tour','fin_tour','cl_veh','employe',
        'nom_employe','vehicule','cl_veh_aff','stationnement','approuve',
        'territoire_debut','adresse_debut','adresse_fin'];
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
            RAISE EXCEPTION 'All 14 fields are required';
        END IF;
        FOREACH v_key IN ARRAY v_keys LOOP
            IF jsonb_typeof(v_row->v_key) <> 'string' THEN RAISE EXCEPTION 'Invalid cell type'; END IF;
        END LOOP;
    END LOOP;

    INSERT INTO public.tct_documents (filename, upload_date, status, user_id, extracted_count, request_id, schedule_date, source_metadata)
    VALUES (p_filename, p_upload_date, 'success', auth.uid(), v_count, p_request_id, nullif(p_metadata->>'schedule_date','')::date, p_metadata)
    ON CONFLICT (user_id, request_id) DO NOTHING RETURNING id INTO v_document_id;

    -- A timeout/retry must not duplicate a previously committed extraction.
    IF v_document_id IS NULL THEN
        SELECT id, extracted_count INTO v_document_id, v_count FROM public.tct_documents
        WHERE user_id::text = auth.uid()::text AND request_id = p_request_id;
        RETURN jsonb_build_object('success', true, 'documentId', v_document_id,
            'tourneesCount', v_count, 'executionTime', 0);
    END IF;

    INSERT INTO public.tct_tournees (document_id, tournee, nom, deb_tour, fin_tour, cl_veh,
        employe, nom_employe, vehicule, cl_veh_aff, stationnement, approuve,
        territoire_debut, adresse_debut, adresse_fin)
    SELECT v_document_id, r.tournee, r.nom, r.deb_tour, r.fin_tour, r.cl_veh,
        r.employe, r.nom_employe, r.vehicule, r.cl_veh_aff,
        r.stationnement, r.approuve, r.territoire_debut, r.adresse_debut, r.adresse_fin
    FROM jsonb_to_recordset(p_tournees) AS r(tournee TEXT, nom TEXT, deb_tour TEXT,
        fin_tour TEXT, cl_veh TEXT, employe TEXT, nom_employe TEXT,
        vehicule TEXT, cl_veh_aff TEXT, stationnement TEXT, approuve TEXT, territoire_debut TEXT,
        adresse_debut TEXT, adresse_fin TEXT);

    INSERT INTO public.tct_history (document_id, action, status, message)
    VALUES (v_document_id, 'extraction_saved', 'success', v_count || ' tournées sauvegardées');
    RETURN jsonb_build_object('success', true, 'documentId', v_document_id,
        'tourneesCount', v_count, 'executionTime', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB,JSONB) TO authenticated;
COMMIT;
