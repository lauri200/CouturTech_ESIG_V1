-- CouturTech – schéma PostgreSQL (V1)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS utilisateur (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(80) NOT NULL,
  prenom VARCHAR(80) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  telephone VARCHAR(20) NOT NULL,
  mot_de_passe_hash VARCHAR(100) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('CLIENT','GERANT','TAILLEUR','LIVREUR')),
  adresse VARCHAR(200),
  quartier VARCHAR(80),
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  doit_changer_mdp BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reinitialisation_mdp (
  id SERIAL PRIMARY KEY,
  utilisateur_id INT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expire_at TIMESTAMPTZ NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS fichier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(160) NOT NULL,
  type_mime VARCHAR(40) NOT NULL,
  donnees BYTEA NOT NULL,
  utilisateur_id INT REFERENCES utilisateur(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modele (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(30) NOT NULL UNIQUE,
  nom VARCHAR(120) NOT NULL,
  categorie VARCHAR(40) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prix_confection INT NOT NULL CHECK (prix_confection >= 0),
  delai_jours INT NOT NULL CHECK (delai_jours > 0),
  mis_en_avant BOOLEAN NOT NULL DEFAULT FALSE,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modele_photo (
  id SERIAL PRIMARY KEY,
  modele_id INT NOT NULL REFERENCES modele(id) ON DELETE CASCADE,
  url VARCHAR(300) NOT NULL,
  ordre INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modele_metrage (
  id SERIAL PRIMARY KEY,
  modele_id INT NOT NULL REFERENCES modele(id) ON DELETE CASCADE,
  taille VARCHAR(3) NOT NULL CHECK (taille IN ('S','M','L','XL','2XL','3XL')),
  metres NUMERIC(5,2) NOT NULL CHECK (metres > 0),
  UNIQUE (modele_id, taille)
);

CREATE TABLE IF NOT EXISTS tissu (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(120) NOT NULL,
  type VARCHAR(40) NOT NULL,
  couleur VARCHAR(60) NOT NULL DEFAULT '',
  photo_url VARCHAR(300),
  prix_metre INT NOT NULL CHECK (prix_metre >= 0),
  stock_metres NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (stock_metres >= 0),
  seuil_alerte NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compteur (
  cle VARCHAR(20) PRIMARY KEY,
  valeur INT NOT NULL
);

CREATE TABLE IF NOT EXISTS commande (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(20) NOT NULL UNIQUE,
  client_id INT NOT NULL REFERENCES utilisateur(id),
  modele_id INT NOT NULL REFERENCES modele(id),
  taille VARCHAR(3) NOT NULL CHECK (taille IN ('S','M','L','XL','2XL','3XL')),
  source_tissu VARCHAR(6) NOT NULL CHECK (source_tissu IN ('MAISON','CLIENT')),
  tissu_id INT REFERENCES tissu(id),
  description_tissu_client TEXT,
  photo_tissu_client_url VARCHAR(300),
  metrage NUMERIC(5,2) NOT NULL,
  prix_confection INT NOT NULL,
  prix_tissu INT NOT NULL DEFAULT 0,
  frais_collecte INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  statut VARCHAR(20) NOT NULL,
  statut_paiement VARCHAR(10) NOT NULL DEFAULT 'NON_PAYE' CHECK (statut_paiement IN ('NON_PAYE','ACOMPTE','SOLDE')),
  montant_paye INT NOT NULL DEFAULT 0,
  date_debut DATE,
  date_remise_prevue DATE,
  tailleur_id INT REFERENCES utilisateur(id),
  deadline DATE,
  alerte_delai_envoyee BOOLEAN NOT NULL DEFAULT FALSE,
  retard_notifie BOOLEAN NOT NULL DEFAULT FALSE,
  notes_retouches TEXT,
  note_tailleur TEXT,
  idempotency_key VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (statut IN ('CONFIRMEE','EN_ATTENTE_COLLECTE','TISSU_RECU','ATTRIBUEE','EN_CONFECTION','PRETE','EN_ESSAYAGE','RETIREE','ANNULEE')),
  CHECK ((source_tissu = 'MAISON' AND tissu_id IS NOT NULL) OR (source_tissu = 'CLIENT' AND tissu_id IS NULL)),
  UNIQUE (client_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_commande_statut ON commande(statut);
CREATE INDEX IF NOT EXISTS idx_commande_tailleur ON commande(tailleur_id);
CREATE INDEX IF NOT EXISTS idx_commande_client ON commande(client_id);

CREATE TABLE IF NOT EXISTS historique_statut (
  id SERIAL PRIMARY KEY,
  commande_id INT NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  ancien_statut VARCHAR(20),
  nouveau_statut VARCHAR(20) NOT NULL,
  utilisateur_id INT REFERENCES utilisateur(id),
  motif TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collecte (
  id SERIAL PRIMARY KEY,
  commande_id INT NOT NULL UNIQUE REFERENCES commande(id) ON DELETE CASCADE,
  livreur_id INT REFERENCES utilisateur(id),
  adresse VARCHAR(200) NOT NULL,
  quartier VARCHAR(80) NOT NULL,
  repere VARCHAR(200),
  telephone VARCHAR(20) NOT NULL,
  date_souhaitee DATE,
  creneau_souhaite VARCHAR(20),
  date_prevue DATE,
  creneau VARCHAR(20),
  statut VARCHAR(16) NOT NULL DEFAULT 'A_PLANIFIER' CHECK (statut IN ('A_PLANIFIER','PLANIFIEE','COLLECTEE','REMISE_ATELIER','ECHOUEE')),
  motif_echec TEXT,
  collectee_at TIMESTAMPTZ,
  remise_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mouvement_stock (
  id SERIAL PRIMARY KEY,
  tissu_id INT NOT NULL REFERENCES tissu(id) ON DELETE CASCADE,
  commande_id INT REFERENCES commande(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('ENTREE','SORTIE','RETOUR','AJUSTEMENT')),
  metres NUMERIC(8,2) NOT NULL,
  motif TEXT,
  utilisateur_id INT REFERENCES utilisateur(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paiement (
  id SERIAL PRIMARY KEY,
  commande_id INT NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  montant INT NOT NULL CHECK (montant > 0),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('ESPECES','MOBILE_MONEY','AUTRE')),
  reference VARCHAR(80),
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  enregistre_par INT REFERENCES utilisateur(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facture (
  id SERIAL PRIMARY KEY,
  commande_id INT NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  type VARCHAR(8) NOT NULL CHECK (type IN ('DEVIS','FACTURE')),
  numero VARCHAR(20) NOT NULL UNIQUE,
  montant_total INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (commande_id, type)
);

CREATE TABLE IF NOT EXISTS notification (
  id SERIAL PRIMARY KEY,
  utilisateur_id INT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  commande_id INT REFERENCES commande(id) ON DELETE CASCADE,
  code VARCHAR(4) NOT NULL,
  canal VARCHAR(5) NOT NULL CHECK (canal IN ('EMAIL','SMS','INAPP')),
  sujet VARCHAR(200),
  contenu TEXT NOT NULL,
  statut VARCHAR(10) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','ENVOYEE','ECHEC')),
  tentatives INT NOT NULL DEFAULT 0,
  erreur TEXT,
  lue BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(utilisateur_id, canal, lue);

CREATE TABLE IF NOT EXISTS parametre (
  cle VARCHAR(40) PRIMARY KEY,
  valeur TEXT NOT NULL
);
