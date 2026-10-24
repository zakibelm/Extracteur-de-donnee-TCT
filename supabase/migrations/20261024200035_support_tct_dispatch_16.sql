-- Additive upgrade. Existing documents and rows are retained.
BEGIN;
ALTER TABLE public.tct_tournees ADD COLUMN IF NOT EXISTS employe_affecte TEXT NOT NULL DEFAULT '';
ALTER TABLE public.tct_tournees ADD COLUMN IF NOT EXISTS autoris TEXT NOT NULL DEFAULT '';
ALTER TABLE public.tct_tournees ADD COLUMN IF NOT EXISTS retour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.tct_tournees ADD COLUMN IF NOT EXISTS statut_fdr TEXT NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.save_tct_extraction(p_request_id uuid, p_filename text, p_upload_date timestamp with time zone, p_tournees jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_document_id BIGINT;
    v_count INTEGER;
    v_row JSONB;
    v_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
    v_code TEXT;
    v_date DATE;
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
    IF jsonb_typeof(v_metadata) <> 'object' THEN RAISE EXCEPTION 'Invalid metadata'; END IF;
    IF COALESCE(v_metadata->>'review_required','false') = 'true' THEN RAISE EXCEPTION 'Legacy extraction must be reanalysed'; END IF;
    IF v_metadata ? 'source_layout' AND v_metadata->>'source_layout' NOT IN ('dispatch_14','dispatch_16') THEN RAISE EXCEPTION 'Unknown source layout'; END IF;
    v_code := NULLIF(v_metadata->>'schedule_code','');
    IF v_code IS NOT NULL THEN
        IF v_code !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'Invalid schedule code'; END IF;
        v_date := make_date(substring(v_code,1,4)::int, substring(v_code,5,2)::int, substring(v_code,7,2)::int);
        v_metadata := v_metadata || jsonb_build_object('schedule_date',v_date::text);
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
        FOREACH v_key IN ARRAY ARRAY['employe_affecte','autoris','retour','statut_fdr'] LOOP
            IF v_row ? v_key AND jsonb_typeof(v_row->v_key) <> 'string' THEN RAISE EXCEPTION 'Invalid extra field'; END IF;
        END LOOP;
        IF v_metadata->>'source_layout' = 'dispatch_16' THEN
            IF NOT (v_row ?& ARRAY['employe_affecte','autoris','retour','statut_fdr']) THEN RAISE EXCEPTION 'All 16 source fields are required'; END IF;
            IF v_row->>'cl_veh_aff' ~ '^[0-9]+$' THEN RAISE EXCEPTION 'Shifted vehicle class'; END IF;
        END IF;
    END LOOP;

    INSERT INTO public.tct_documents (filename, upload_date, status, user_id, extracted_count, request_id, schedule_date, source_metadata)
    VALUES (p_filename, p_upload_date, 'success', auth.uid(), v_count, p_request_id, nullif(v_metadata->>'schedule_date','')::date, v_metadata)
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
        territoire_debut, adresse_debut, adresse_fin, employe_affecte, autoris, retour, statut_fdr)
    SELECT v_document_id, r.tournee, r.nom, r.deb_tour, r.fin_tour, r.cl_veh,
        r.employe, r.nom_employe, r.vehicule, r.cl_veh_aff,
        r.stationnement, r.approuve, r.territoire_debut, r.adresse_debut, r.adresse_fin, COALESCE(r.employe_affecte,''), COALESCE(r.autoris,''), COALESCE(r.retour,''), COALESCE(r.statut_fdr,'')
    FROM jsonb_to_recordset(p_tournees) AS r(tournee TEXT, nom TEXT, deb_tour TEXT,
        fin_tour TEXT, cl_veh TEXT, employe TEXT, nom_employe TEXT,
        vehicule TEXT, cl_veh_aff TEXT, stationnement TEXT, approuve TEXT, territoire_debut TEXT,
        adresse_debut TEXT, adresse_fin TEXT, employe_affecte TEXT, autoris TEXT, retour TEXT, statut_fdr TEXT);

    INSERT INTO public.tct_history (document_id, action, status, message)
    VALUES (v_document_id, 'extraction_saved', 'success', v_count || ' tournées sauvegardées');
    RETURN jsonb_build_object('success', true, 'documentId', v_document_id,
        'tourneesCount', v_count, 'executionTime', 0);
END;
$function$

REVOKE ALL ON FUNCTION public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tct_extraction(UUID,TEXT,TIMESTAMPTZ,JSONB,JSONB) TO authenticated;
COMMIT;
