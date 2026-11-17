process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://couturtech:couturtech@localhost:5432/couturtech_test';
process.env.DISABLE_LOCAL_CRON = 'true';

const request = require('supertest');
const { seed, MDP_DEMO } = require('../scripts/seed');
const app = require('../src/app');
const { pool } = require('../src/db');
const { executerAlertes } = require('../src/services/alertes');

const tokens = {};
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, mot_de_passe: MDP_DEMO })).body.token;
const as = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  await seed();
  tokens.client = await login('client@couturtech.tg');
  tokens.client2 = await login('client2@couturtech.tg');
  tokens.gerant = await login('gerant@couturtech.tg');
  tokens.tailleur = await login('tailleur@couturtech.tg');
  tokens.tailleur2 = await login('tailleur2@couturtech.tg');
  tokens.livreur = await login('livreur@couturtech.tg');
});
afterAll(() => pool.end());

const LIV = { adresse: 'Rue de la livraison', quartier: 'Bè', telephone: '+228 90 00 00 05' };
const dans = (j) => { const d = new Date(); d.setDate(d.getDate() + j); return d.toISOString().slice(0, 10); };

describe('Authentification et rôles', () => {
  test('inscription client puis 409 si e-mail déjà utilisé', async () => {
    const body = { nom: 'Test', prenom: 'Ana', telephone: '+228 91 00 00 00', email: 'ana@test.tg', mot_de_passe: 'motdepasse1', consentement: true };
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201);
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(409);
  });
  test('422 si téléphone invalide ou consentement absent', async () => {
    const r = await request(app).post('/api/auth/register').send({ nom: 'a', prenom: 'b', telephone: '123', email: 'x@y.tg', mot_de_passe: 'motdepasse1' });
    expect(r.status).toBe(422);
  });
  test('401 sans jeton, 401 mauvais mot de passe, 403 rôle interdit', async () => {
    expect((await request(app).get('/api/commandes')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'client@couturtech.tg', mot_de_passe: 'faux' })).status).toBe(401);
    expect((await request(app).get('/api/dashboard').set(as('client'))).status).toBe(403);
    expect((await request(app).get('/api/commandes').set(as('livreur'))).status).toBe(403);
  });
});

describe('Parcours tissu maison', () => {
  let cmd;
  test('création : statut CONFIRMEE, stock déduit, devis, notification N01', async () => {
    const tissu = (await request(app).get('/api/tissus/1')).body;
    const r = await request(app).post('/api/commandes').set(as('client')).set('Idempotency-Key', 'k1')
      .send({ modele_id: 3, taille: 'M', source_tissu: 'MAISON', tissu_id: 1, livraison: LIV });
    expect(r.status).toBe(201);
    cmd = r.body;
    expect(cmd.statut).toBe('CONFIRMEE');
    expect(cmd.frais_livraison).toBe(1000);
    expect(cmd.total).toBe(cmd.prix_confection + Math.round(tissu.prix_metre * cmd.metrage) + 1000);
    const apres = (await request(app).get('/api/tissus/1')).body;
    expect(apres.stock_metres).toBeCloseTo(tissu.stock_metres - cmd.metrage);
    const n = await pool.query("SELECT 1 FROM notification WHERE commande_id = $1 AND code = 'N01' AND canal = 'EMAIL'", [cmd.id]);
    expect(n.rowCount).toBe(1);
    expect((await request(app).get(`/api/commandes/${cmd.id}/devis.pdf`).set(as('client'))).headers['content-type']).toMatch(/pdf/);
  });
  test('idempotence : même clé = même commande', async () => {
    const r = await request(app).post('/api/commandes').set(as('client')).set('Idempotency-Key', 'k1')
      .send({ modele_id: 3, taille: 'M', source_tissu: 'MAISON', tissu_id: 1, livraison: LIV });
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(cmd.id);
  });
  test('409 stock insuffisant ; 422 taille invalide', async () => {
    expect((await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 2, taille: '3XL', source_tissu: 'MAISON', tissu_id: 8, livraison: LIV })).status).toBe(409);
    expect((await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 2, taille: 'XXL', source_tissu: 'MAISON', tissu_id: 1, livraison: LIV })).status).toBe(422);
  });
  test('un client ne voit pas la commande d’un autre (403)', async () => {
    expect((await request(app).get(`/api/commandes/${cmd.id}`).set(as('client2'))).status).toBe(403);
  });
  test('attribution : deadline obligatoire et ≤ remise prévue', async () => {
    expect((await request(app).post(`/api/commandes/${cmd.id}/attribuer`).set(as('gerant')).send({ tailleur_id: 2 })).status).toBe(422);
    expect((await request(app).post(`/api/commandes/${cmd.id}/attribuer`).set(as('gerant')).send({ tailleur_id: 2, deadline: dans(60) })).status).toBe(422);
    expect((await request(app).post(`/api/commandes/${cmd.id}/attribuer`).set(as('gerant')).send({ tailleur_id: 2, deadline: dans(2) })).status).toBe(409);
    const ac = await request(app).post(`/api/commandes/${cmd.id}/paiements`).set(as('gerant')).send({ montant: Math.ceil(cmd.total / 2), mode: 'ESPECES' });
    expect(ac.body.statut_paiement).toBe('ACOMPTE');
    const r = await request(app).post(`/api/commandes/${cmd.id}/attribuer`).set(as('gerant')).send({ tailleur_id: 2, deadline: dans(2) });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe('ATTRIBUEE');
  });
  test('tailleur : vue sans prix ni téléphone ; un autre tailleur est refusé', async () => {
    const r = await request(app).get(`/api/commandes/${cmd.id}`).set(as('tailleur'));
    expect(r.status).toBe(200);
    expect(r.body.total).toBeUndefined();
    expect(r.body.client_telephone).toBeUndefined();
    expect((await request(app).patch(`/api/commandes/${cmd.id}/statut`).set(as('tailleur2')).send({ statut: 'EN_CONFECTION' })).status).toBe(403);
  });
  test('transition interdite → 409', async () => {
    expect((await request(app).patch(`/api/commandes/${cmd.id}/statut`).set(as('gerant')).send({ statut: 'PRETE' })).status).toBe(409);
  });
  test('422 sans adresse de livraison', async () => {
    expect((await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 3, taille: 'M', source_tissu: 'MAISON', tissu_id: 1 })).status).toBe(422);
  });
  let liv;
  test('confection → prête (N08 e-mail + SMS) → mission de livraison créée', async () => {
    expect((await request(app).patch(`/api/commandes/${cmd.id}/statut`).set(as('tailleur')).send({ statut: 'EN_CONFECTION' })).status).toBe(200);
    expect((await request(app).patch(`/api/commandes/${cmd.id}/statut`).set(as('tailleur')).send({ statut: 'PRETE' })).status).toBe(200);
    const n = await pool.query("SELECT canal FROM notification WHERE commande_id = $1 AND code = 'N08'", [cmd.id]);
    expect(n.rows.map((x) => x.canal)).toEqual(expect.arrayContaining(['EMAIL', 'SMS']));
    const d = (await request(app).get(`/api/commandes/${cmd.id}`).set(as('gerant'))).body;
    liv = d.missions.find((m) => m.type === 'LIVRAISON');
    expect(liv.statut).toBe('A_PLANIFIER');
    expect(liv.adresse).toBe(LIV.adresse);
  });
  test('livraison refusée tant que non soldée, puis livrée avec facture', async () => {
    const planif = { livreur_id: 4, date_prevue: dans(1), creneau: '10h-12h' };
    expect((await request(app).patch(`/api/collectes/${liv.id}/planifier`).set(as('gerant')).send(planif)).status).toBe(409);
    expect((await request(app).post(`/api/commandes/${cmd.id}/paiements`).set(as('gerant')).send({ montant: cmd.total + 1, mode: 'ESPECES' })).status).toBe(422);
    const p1 = await request(app).post(`/api/commandes/${cmd.id}/paiements`).set(as('gerant')).send({ montant: 1000, mode: 'ESPECES' });
    expect(p1.body.statut_paiement).toBe('ACOMPTE');
    const p2 = await request(app).post(`/api/commandes/${cmd.id}/paiements`).set(as('gerant')).send({ montant: cmd.total - Math.ceil(cmd.total / 2) - 1000, mode: 'MOBILE_MONEY' });
    expect(p2.body.statut_paiement).toBe('SOLDE');
    expect((await request(app).patch(`/api/collectes/${liv.id}/planifier`).set(as('gerant')).send(planif)).status).toBe(200);
    expect((await request(app).get(`/api/commandes/${cmd.id}`).set(as('client'))).body.statut).toBe('EN_LIVRAISON');
    expect((await pool.query("SELECT 1 FROM notification WHERE commande_id = $1 AND code = 'N14'", [cmd.id])).rowCount).toBeGreaterThan(0);
    expect((await request(app).patch(`/api/collectes/${liv.id}/statut`).set(as('livreur')).send({ statut: 'ECHOUEE', motif: 'Client absent' })).status).toBe(200);
    expect((await request(app).get(`/api/commandes/${cmd.id}`).set(as('client'))).body.statut).toBe('PRETE');
    expect((await request(app).patch(`/api/collectes/${liv.id}/planifier`).set(as('gerant')).send({ ...planif, date_prevue: dans(2) })).status).toBe(200);
    const r = await request(app).patch(`/api/collectes/${liv.id}/statut`).set(as('livreur')).send({ statut: 'COLLECTEE' });
    expect(r.status).toBe(200);
    expect(r.body.telephone).toBe('—');
    expect((await request(app).patch(`/api/collectes/${liv.id}/statut`).set(as('livreur')).send({ statut: 'REMISE_ATELIER' })).status).toBe(409);
    expect((await request(app).get(`/api/commandes/${cmd.id}`).set(as('client'))).body.statut).toBe('LIVREE');
    expect((await request(app).get(`/api/commandes/${cmd.id}/facture.pdf`).set(as('client'))).status).toBe(200);
  });
  test('retouche à distance : demande client → récupération → atelier → nouvelle livraison', async () => {
    expect((await request(app).post(`/api/commandes/${cmd.id}/retouche`).set(as('client2')).send({ motif: 'Manches trop longues' })).status).toBe(403);
    expect((await request(app).post(`/api/commandes/${cmd.id}/retouche`).set(as('client')).send({ motif: 'ab' })).status).toBe(422);
    const r = await request(app).post(`/api/commandes/${cmd.id}/retouche`).set(as('client')).send({ motif: 'Manches trop longues de 2 cm' });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe('RETOUCHE_DEMANDEE');
    expect((await pool.query("SELECT 1 FROM notification WHERE commande_id = $1 AND code = 'N15'", [cmd.id])).rowCount).toBeGreaterThan(0);
    const d = (await request(app).get(`/api/commandes/${cmd.id}`).set(as('gerant'))).body;
    const ret = d.missions.find((m) => m.type === 'RETOUCHE');
    expect((await request(app).patch(`/api/collectes/${ret.id}/planifier`).set(as('gerant')).send({ livreur_id: 4, date_prevue: dans(1), creneau: '14h-16h' })).status).toBe(200);
    expect((await request(app).patch(`/api/collectes/${ret.id}/statut`).set(as('livreur')).send({ statut: 'COLLECTEE' })).status).toBe(200);
    expect((await request(app).patch(`/api/collectes/${ret.id}/statut`).set(as('livreur')).send({ statut: 'REMISE_ATELIER' })).status).toBe(200);
    const t = (await request(app).get(`/api/commandes/${cmd.id}`).set(as('tailleur'))).body;
    expect(t.statut).toBe('EN_CONFECTION');
    expect(t.notes_retouches).toBe('Manches trop longues de 2 cm');
    expect((await request(app).patch(`/api/commandes/${cmd.id}/statut`).set(as('tailleur')).send({ statut: 'PRETE' })).status).toBe(200);
    const d2 = (await request(app).get(`/api/commandes/${cmd.id}`).set(as('gerant'))).body;
    expect(d2.missions.filter((m) => m.type === 'LIVRAISON' && m.statut === 'A_PLANIFIER')).toHaveLength(1);
  });
});

describe('Parcours tissu client + collecte', () => {
  let cmd; let co;
  test('création : EN_ATTENTE_COLLECTE + collecte A_PLANIFIER', async () => {
    const r = await request(app).post('/api/commandes').set(as('client')).send({
      modele_id: 1, taille: 'L', source_tissu: 'CLIENT', description_tissu_client: 'Wax 6 m', livraison: LIV,
      collecte: { adresse: 'Rue test', quartier: 'Bè', telephone: '+228 90 00 00 05', date_souhaitee: dans(1), creneau_souhaite: '10h-12h' },
    });
    expect(r.status).toBe(201);
    cmd = r.body;
    expect(cmd.statut).toBe('EN_ATTENTE_COLLECTE');
    co = (await request(app).get('/api/collectes').set(as('gerant'))).body.find((x) => x.commande_id === cmd.id);
    expect(co.statut).toBe('A_PLANIFIER');
  });
  test('attribution impossible avant TISSU_RECU (409)', async () => {
    expect((await request(app).post(`/api/commandes/${cmd.id}/attribuer`).set(as('gerant')).send({ tailleur_id: 2, deadline: dans(2) })).status).toBe(409);
  });
  test('planification → livreur : échec avec motif → replanif → récupéré → remis → TISSU_RECU', async () => {
    expect((await request(app).patch(`/api/collectes/${co.id}/planifier`).set(as('gerant')).send({ livreur_id: 4, date_prevue: dans(1), creneau: '10h-12h' })).status).toBe(200);
    expect((await request(app).patch(`/api/collectes/${co.id}/statut`).set(as('livreur')).send({ statut: 'ECHOUEE' })).status).toBe(422);
    expect((await request(app).patch(`/api/collectes/${co.id}/statut`).set(as('livreur')).send({ statut: 'ECHOUEE', motif: 'Client absent' })).status).toBe(200);
    expect((await request(app).patch(`/api/collectes/${co.id}/planifier`).set(as('gerant')).send({ livreur_id: 4, date_prevue: dans(2), creneau: '14h-16h' })).status).toBe(200);
    expect((await request(app).patch(`/api/collectes/${co.id}/statut`).set(as('livreur')).send({ statut: 'COLLECTEE' })).status).toBe(200);
    // annulation client impossible une fois le tissu récupéré
    expect((await request(app).post(`/api/commandes/${cmd.id}/annuler`).set(as('client')).send({})).status).toBe(409);
    const r = await request(app).patch(`/api/collectes/${co.id}/statut`).set(as('livreur')).send({ statut: 'REMISE_ATELIER' });
    expect(r.status).toBe(200);
    expect(r.body.telephone).toBe('—');
    expect((await request(app).get(`/api/commandes/${cmd.id}`).set(as('client'))).body.statut).toBe('TISSU_RECU');
    expect((await request(app).post(`/api/commandes/${cmd.id}/paiements`).set(as('gerant')).send({ montant: Math.ceil(cmd.total / 2), mode: 'MOBILE_MONEY' })).status).toBe(201);
    expect((await request(app).post(`/api/commandes/${cmd.id}/attribuer`).set(as('gerant')).send({ tailleur_id: 2, deadline: dans(2) })).status).toBe(200);
  });
});

describe('Mensurations et scan par photos', () => {
  const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  const SCAN = { age: 29, genre: 'female', stature_cm: 164, poids_kg: 54, photo_face: PHOTO, photo_profil: PHOTO };
  afterEach(() => { delete process.env.BODYGRAM_ORG_ID; delete process.env.BODYGRAM_API_KEY; jest.restoreAllMocks(); });
  test('saisie manuelle, liste privée, liaison à une commande', async () => {
    expect((await request(app).post('/api/mensurations').set(as('client')).send({ valeurs: {} })).status).toBe(422);
    const m = await request(app).post('/api/mensurations').set(as('client')).send({ valeurs: { tour_poitrine: 92, tour_taille: 74.5, tour_hanches: 98 } });
    expect(m.status).toBe(201);
    expect(m.body.source).toBe('MANUEL');
    expect((await request(app).get('/api/mensurations').set(as('client2'))).body.find((x) => x.id === m.body.id)).toBeUndefined();
    const autre = await request(app).post('/api/commandes').set(as('client2')).send({ modele_id: 3, taille: 'M', source_tissu: 'MAISON', tissu_id: 1, livraison: LIV, mensuration_id: m.body.id });
    expect(autre.status).toBe(422);
    const c = await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 3, taille: 'M', source_tissu: 'MAISON', tissu_id: 1, livraison: LIV, mensuration_id: m.body.id });
    expect(c.status).toBe(201);
    expect((await request(app).get(`/api/commandes/${c.body.id}`).set(as('client'))).body.mensuration.valeurs.tour_taille).toBe(74.5);
  });
  test('taille calculée d’après les mensurations (sans choix S à 3XL)', async () => {
    const m = await request(app).post('/api/mensurations').set(as('client')).send({ valeurs: { tour_poitrine: 92, tour_taille: 74.5, tour_hanches: 98 } });
    const c = await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 3, source_tissu: 'MAISON', tissu_id: 1, livraison: LIV, mensuration_id: m.body.id });
    expect(c.status).toBe(201);
    expect(c.body.taille).toBe('L');
    expect((await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 3, source_tissu: 'MAISON', tissu_id: 1, livraison: LIV })).status).toBe(422);
  });
  test('scan : 503 si Bodygram non configuré', async () => {
    expect((await request(app).get('/api/mensurations/config').set(as('client'))).body.scan_disponible).toBe(false);
    expect((await request(app).post('/api/mensurations/scan').set(as('client')).send(SCAN)).status).toBe(503);
  });
  test('scan : appel serveur Bodygram simulé, conversion mm → cm, clé jamais renvoyée', async () => {
    process.env.BODYGRAM_ORG_ID = 'org-test';
    process.env.BODYGRAM_API_KEY = 'cle-test';
    const appel = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ entry: { id: 'scan1', status: 'success', measurements: [
      { name: 'bustGirth', unit: 'mm', value: 895 }, { name: 'waistGirth', unit: 'mm', value: 762 }, { name: 'hipGirth', unit: 'mm', value: 905 }] } }) });
    const r = await request(app).post('/api/mensurations/scan').set(as('client')).send(SCAN);
    expect(r.status).toBe(201);
    expect(r.body.valeurs).toMatchObject({ tour_poitrine: 89.5, tour_taille: 76.2, tour_hanches: 90.5, stature: 164 });
    expect(JSON.stringify(r.body)).not.toContain('cle-test');
    const [url, opts] = appel.mock.calls[0];
    expect(url).toBe('https://platform.bodygram.com/api/orgs/org-test/scans');
    expect(opts.headers.Authorization).toBe('cle-test');
    expect(JSON.parse(opts.body).photoScan).toMatchObject({ height: 1640, weight: 54000, gender: 'female' });
    appel.mockResolvedValue({ ok: true, json: async () => ({ entry: { status: 'failure' } }) });
    expect((await request(app).post('/api/mensurations/scan').set(as('client')).send(SCAN)).status).toBe(422);
  });
});

describe('Annulation, deadline et alertes', () => {
  test('annulation client d’une commande CONFIRMEE : stock restitué', async () => {
    const avant = (await request(app).get('/api/tissus/4')).body.stock_metres;
    const c = (await request(app).post('/api/commandes').set(as('client')).send({ modele_id: 3, taille: 'S', source_tissu: 'MAISON', tissu_id: 4, livraison: LIV })).body;
    const r = await request(app).post(`/api/commandes/${c.id}/annuler`).set(as('client')).send({});
    expect(r.body.statut).toBe('ANNULEE');
    expect((await request(app).get('/api/tissus/4')).body.stock_metres).toBeCloseTo(avant);
  });
  test('modification de date : motif obligatoire, historisée, N07 au client', async () => {
    const c = (await request(app).get('/api/commandes?statut=EN_CONFECTION').set(as('gerant'))).body[0];
    expect((await request(app).patch(`/api/commandes/${c.id}/deadline`).set(as('gerant')).send({ date_remise_prevue: dans(20) })).status).toBe(422);
    expect((await request(app).patch(`/api/commandes/${c.id}/deadline`).set(as('gerant')).send({ date_remise_prevue: dans(20), motif: 'Broderie' })).status).toBe(200);
    expect((await pool.query("SELECT 1 FROM notification WHERE commande_id = $1 AND code = 'N07'", [c.id])).rowCount).toBeGreaterThan(0);
  });
  test('cron : retard notifié une seule fois (N06) ; 401 sans secret', async () => {
    await pool.query("DELETE FROM notification WHERE code = 'N06'");
    await pool.query("UPDATE commande SET retard_notifie = FALSE WHERE deadline < CURRENT_DATE AND statut IN ('ATTRIBUEE','EN_CONFECTION')");
    const r1 = await executerAlertes();
    expect(r1.retards).toBeGreaterThan(0);
    expect((await executerAlertes()).retards).toBe(0);
    expect((await request(app).get('/api/cron/alertes')).status).toBe(401);
  });
  test('recherche et filtres combinés', async () => {
    const r = await request(app).get('/api/commandes?q=CMD-2026&statut=CONFIRMEE,LIVREE&paiement=SOLDE').set(as('gerant'));
    expect(r.status).toBe(200);
    expect(r.body.every((c) => c.statut_paiement === 'SOLDE' && ['CONFIRMEE', 'LIVREE'].includes(c.statut))).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
  });
  test('dashboard gérant', async () => {
    const r = await request(app).get('/api/dashboard').set(as('gerant'));
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('en_retard');
  });
});
