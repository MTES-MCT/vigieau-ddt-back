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

-- USAGES GUIDE SECHERESSE
INSERT INTO public.usage (id, nom, "thematiqueId")
SELECT id_usage, nom_usage, id_thematique from talend_ingestion_ppluvia.usage;
SELECT setval('usage_id_seq', (SELECT MAX(id) FROM public.usage)+1);

-- ZONES D'ALERTE
INSERT INTO public.zone_alerte (id, type, "departementId", "bassinVersantId", nom, code, "numeroVersion", geom)
SELECT id_zone, type_zone, id_dep, id_bassin, nom_zone, code_zone, numero_version, the_geom from talend_ingestion_ppluvia.zones_alertes;
SELECT setval('zone_alerte_id_seq', (SELECT MAX(id) FROM public.zone_alerte)+1);

-- Flaguer les anciennes zones en disabled
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

-- USAGES TEMPLATE
UPDATE public.usage
SET "isTemplate" = true

-- HISTORIC USAGES
-- Si il y a plusieurs usages avec le même nom et pas la même thématique, on prend une thématique au hasard
INSERT INTO public.usage (nom, "thematiqueId")
SELECT libelle_usage_ddt, min(id_thematique) id_thematique
from talend_ingestion_ppluvia.restriction
WHERE libelle_usage_ddt NOT IN (SELECT u.nom FROM public.usage as u) and libelle_usage_ddt is not null and libelle_usage_ddt <> ''
GROUP BY libelle_usage_ddt;

-- USAGES ARRETE CADRE
INSERT INTO public.usage_arrete_cadre ("usageId", "arreteCadreId", "concerneParticulier", "concerneEntreprise", "concerneCollectivite", "concerneExploitation")
-- USAGES ARRETE CADRE GUIDE SECHERESSE
select id, id_arrete_cadre, bool_or(part_concerne_on), bool_or(entrep_concerne_on), bool_or(coll_concerne_on), bool_or(exploit_concerne_on)
from (
select u.id, r.id_arrete_cadre, bool_or(r.part_concerne_on) as part_concerne_on,
	bool_or(r.entrep_concerne_on) as entrep_concerne_on,
	bool_or(r.coll_concerne_on) as coll_concerne_on,
	bool_or(r.exploit_concerne_on) as exploit_concerne_on
from talend_ingestion_ppluvia.restriction as r
left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
left join public.usage as u on u.nom = u_old.nom_usage
where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '')
and u.id is not null and r.id_arrete_cadre is not null
group by u.id, r.id_arrete_cadre union
-- USAGES ARRETE CADRE CUSTOM LIBELLE
select u.id, r.id_arrete_cadre, bool_or(r.part_concerne_on) as part_concerne_on,
	bool_or(r.entrep_concerne_on) as entrep_concerne_on,
	bool_or(r.coll_concerne_on) as coll_concerne_on,
	bool_or(r.exploit_concerne_on) as exploit_concerne_on
from talend_ingestion_ppluvia.restriction as r
left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
left join public.usage as u on u.nom = r.libelle_usage_ddt
where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> ''
and u.id is not null and r.id_arrete_cadre is not null
group by u.id, r.id_arrete_cadre) z
group by id, id_arrete_cadre;

-- USAGE ARRETE CADRE GUIDE SECHERESSE DESCRIPTION VIGILANCE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionVigilance" = (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 17
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId");
UPDATE public.usage_arrete_cadre set "descriptionVigilance" = null where "descriptionVigilance" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionVigilance" = concat_ws(',' , "descriptionVigilance", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 17
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionVigilance" = null where "descriptionVigilance" = '';

-- USAGE ARRETE CADRE CUSTOM LIBELLE DESCRIPTION VIGILANCE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionVigilance" =  concat_ws(',' , "descriptionVigilance", (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 17
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionVigilance" = null where "descriptionVigilance" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionVigilance" = concat_ws(',' , "descriptionVigilance", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 17
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionVigilance" = null where "descriptionVigilance" = '';

-- USAGE ARRETE CADRE GUIDE SECHERESSE DESCRIPTION ALERTE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerte" = (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 18
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId");
UPDATE public.usage_arrete_cadre set "descriptionAlerte" = null where "descriptionAlerte" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerte" = concat_ws(',' , "descriptionAlerte", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 18
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionAlerte" = null where "descriptionAlerte" = '';

-- USAGE ARRETE CADRE CUSTOM LIBELLE DESCRIPTION ALERTE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerte" =  concat_ws(',' , "descriptionAlerte", (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 18
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionAlerte" = null where "descriptionAlerte" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerte" = concat_ws(',' , "descriptionAlerte", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 18
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionAlerte" = null where "descriptionAlerte" = '';

-- USAGE ARRETE CADRE GUIDE SECHERESSE DESCRIPTION ALERTE RENFORCEE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerteRenforcee" = (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 19
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId");
UPDATE public.usage_arrete_cadre set "descriptionAlerteRenforcee" = null where "descriptionAlerteRenforcee" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerteRenforcee" = concat_ws(',' , "descriptionAlerteRenforcee", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 19
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionAlerteRenforcee" = null where "descriptionAlerteRenforcee" = '';

-- USAGE ARRETE CADRE CUSTOM LIBELLE DESCRIPTION ALERTE RENFORCEE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerteRenforcee" = concat_ws(',' , "descriptionAlerteRenforcee", (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 19
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionAlerteRenforcee" = null where "descriptionAlerteRenforcee" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionAlerteRenforcee" = concat_ws(',' , "descriptionAlerteRenforcee", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 19
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionAlerteRenforcee" = null where "descriptionAlerteRenforcee" = '';

-- USAGE ARRETE CADRE GUIDE SECHERESSE DESCRIPTION CRISE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionCrise" = (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 20
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId");
UPDATE public.usage_arrete_cadre set "descriptionCrise" = null where "descriptionCrise" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionCrise" = concat_ws(',' , "descriptionCrise", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = u_old.nom_usage
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where (r.libelle_usage_ddt is null or r.libelle_usage_ddt = '') and ra.id_niveau = 20
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionCrise" = null where "descriptionCrise" = '';

-- USAGE ARRETE CADRE CUSTOM LIBELLE DESCRIPTION CRISE
-- On récupère les descriptions puis les interdictions horaires, enfin si il n'y avait rien, on met le nom de la restriction
UPDATE public.usage_arrete_cadre as uac
SET "descriptionCrise" = concat_ws(',' , "descriptionCrise", (select string_agg(nar.nar_txt, ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 20
                                                     and (nar.nar_txt is not null and nar.nar_txt <> '')
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionCrise" = null where "descriptionCrise" = '';

UPDATE public.usage_arrete_cadre as uac
SET "descriptionCrise" = concat_ws(',' , "descriptionCrise", (select string_agg(concat('Interdiction de ', nar.heure_deb, 'h à ', nar.heure_fin, 'h.'), ', ')
                                                     from talend_ingestion_ppluvia.restriction as r
                                                     left join talend_ingestion_ppluvia.usage as u_old on u_old.id_usage = r.id_usage
                                                     left join public.usage as u on u.nom = r.libelle_usage_ddt
                                                     left join talend_ingestion_ppluvia.restriction_alerte as ra on ra.id_restriction = r.id_restriction
                                                     left join talend_ingestion_ppluvia.niveau_alerte_restriction as nar on nar.id_restrcition_alerte = ra.id_restrcition_alerte
                                                     where r.libelle_usage_ddt is not null and r.libelle_usage_ddt <> '' and ra.id_niveau = 20
                                                     and (nar.heure_deb is not null and nar.heure_fin is not null)
                                                     and u.id = uac."usageId" and r.id_arrete_cadre = uac."arreteCadreId"));
UPDATE public.usage_arrete_cadre set "descriptionCrise" = null where "descriptionCrise" = '';

-- ARRETES RESTRICTIONS
INSERT INTO public.arrete_restriction (id, numero, statut, "dateDebut", "dateFin", "dateSignature")
SELECT id_arrete, numero_arrete, (CASE
                                                                      WHEN id_statut=1 THEN 'a_valider'::arrete_restriction_statut_enum
                                                                      WHEN id_statut=2 THEN 'publie'::arrete_restriction_statut_enum
                                                                      ELSE 'abroge'::arrete_restriction_statut_enum
                                                                    END), debut_val_arrete, fin_val_arrete, date_signature
from talend_ingestion_ppluvia.arretes;
SELECT setval('arrete_restriction_id_seq', (SELECT MAX(id) FROM public.arrete_restriction)+1);

-- ARRETES RESTRICTIONS / ARRETES CADRES
INSERT INTO public.arrete_cadre_arrete_restriction ("arreteCadreId", "arreteRestrictionId")
SELECT DISTINCT id_arrete_cadre, id_arrete from talend_ingestion_ppluvia.arretes where id_arrete_cadre is not null;
