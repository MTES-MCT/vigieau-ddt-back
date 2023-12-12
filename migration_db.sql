-- REGIONS
INSERT INTO public.region (id, code, nom, "domOn")
SELECT id_region, code_region, nom_region, dom_on from talend_ingestion_ppluvia.regions;
SELECT setval('region_id_seq', (SELECT MAX(id) FROM public.region)+1);

-- DEPARTEMENTS
INSERT INTO public.departement (id, "regionId", code, nom, geom)
SELECT id_dep, id_region, code_dep, nom_dep, the_geom from talend_ingestion_ppluvia.departements;
SELECT setval('departement_id_seq', (SELECT MAX(id) FROM public.departement)+1);

-- BASSINS VERSANTS
INSERT INTO public.bassin_versant (id, code, nom)
SELECT id_bassin, code_bassin, nom_bassin from talend_ingestion_ppluvia.bassins_versants;
SELECT setval('bassin_versant_id_seq', (SELECT MAX(id) FROM public.bassin_versant)+1);

-- THEMATIQUES
INSERT INTO public.thematique (id, nom)
SELECT id_thematique, nom_thematique from talend_ingestion_ppluvia.thematique;
SELECT setval('thematique_id_seq', (SELECT MAX(id) FROM public.thematique)+1);

-- USAGES
INSERT INTO public.usage (id, nom, "thematiqueId")
SELECT id_usage, nom_usage, id_thematique from talend_ingestion_ppluvia.usage;
SELECT setval('usage_id_seq', (SELECT MAX(id) FROM public.usage)+1);

-- ZONES D'ALERTE
INSERT INTO public.zone_alerte (id, type, "departementId", "bassinVersantId", nom, code, "numeroVersion", geom)
SELECT id_zone, type_zone, id_dep, id_bassin, nom_zone, code_zone, numero_version, the_geom from talend_ingestion_ppluvia.zones_alertes;
SELECT setval('zone_alerte_id_seq', (SELECT MAX(id) FROM public.zone_alerte)+1);

-- TODO flaguer les anciennes zones en disabled
UPDATE public.zone_alerte
SET disabled = true
WHERE id not in (select za.id
                      FROM public.zone_alerte as za
                      where za."numeroVersion" = (
                      	select max(zaBis."numeroVersion")
                      	FROM public.zone_alerte as zaBis
                      	where zaBis."departementId" = za."departementId" and zaBis.type = za.type
                      ));

-- STATUS ARRETES CADRES
INSERT INTO public.statut_arrete_cadre (id, nom)
SELECT id_statut, libelle_statut from talend_ingestion_ppluvia.statut_arrete_cadre;
SELECT setval('statut_arrete_cadre_id_seq', (SELECT MAX(id) FROM public.statut_arrete_cadre)+1);

-- ARRETES CADRES
INSERT INTO public.arrete_cadre (id, numero, url, statut, "dateDebut", "dateFin", "urlDdt")
SELECT id_arrete_cadre, numero_arrete_cadre, url_arrete_cadre, (CASE
                                                                      WHEN id_statut=1 THEN 'a_valider'::arrete_cadre_statut_enum
                                                                      WHEN id_statut=2 THEN 'publie'::arrete_cadre_statut_enum
                                                                      ELSE 'abroge'::arrete_cadre_statut_enum
                                                                    END), date_debut, date_fin, url_ddt
from talend_ingestion_ppluvia.arretescadres;
SELECT setval('arrete_cadre_id_seq', (SELECT MAX(id) FROM public.arrete_cadre)+1);

-- ARRETES CADRES / DEPARTEMENTS
INSERT INTO public.arrete_cadre_departement ("arreteCadreId", "departementId")
SELECT DISTINCT id_arrete_cadre, id_dep from talend_ingestion_ppluvia.arrete_cadre_dep;

-- ARRETES CADRES / ZONES D'ALERTE
INSERT INTO public.arrete_cadre_zone_alerte ("arreteCadreId", "zoneAlerteId")
SELECT DISTINCT id_arrete_cadre, id_zone from talend_ingestion_ppluvia.arrete_cadre_zone;
