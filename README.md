# CouturTech

Plateforme de gestion de confection de haute couture (Lomé). Mémoire de licence professionnelle ESIG 2025-2026.

Parcours : le client commande un modèle (taille S → 3XL, tissu maison ou tissu client) → un livreur collecte le tissu si besoin → le gérant attribue un tailleur avec une deadline → le client est prévenu quand la tenue est prête → essayage, retouches, retrait.

## Stack
- `client/` : React 18, Vite, Tailwind CSS, React Router
- `server/` : Node.js 20, Express, PostgreSQL (`pg`), JWT, Zod, PDFKit, Nodemailer
- `api/index.js` + `vercel.json` : déploiement Vercel (SPA statique + fonction API + cron quotidien)

## Démarrage local
```bash
cp .env.example .env              # renseigner DATABASE_URL
npm install && npm --prefix client install
npm run db:seed                   # schéma + données de démonstration
npm run dev:server                # API sur http://localhost:4000
npm run dev:client                # interface sur http://localhost:5173
```
PostgreSQL rapide : `docker run -d --name couturtech-db -e POSTGRES_USER=couturtech -e POSTGRES_PASSWORD=couturtech -p 5432:5432 postgres:16-alpine`

Comptes de démonstration (mot de passe `Demo2026!`) : `client@`, `gerant@`, `tailleur@`, `livreur@couturtech.tg`.

## Scripts
| Commande | Rôle |
|---|---|
| `npm test` | Tests API Jest + Supertest (base `couturtech_test`, ou `TEST_DATABASE_URL`) |
| `npm --prefix client run lint` | ESLint frontend |
| `npm run build` | Build de production du frontend |
| `npm run cron` | Alertes de deadline, retards, relance des notifications en échec |

## Déploiement Vercel
Variables à définir : `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `APP_URL`, `CRON_SECRET`, `SMTP_*` (et `SMS_*` quand le fournisseur SMS sera choisi). Sans SMTP/SMS, les envois sont simulés et journalisés.

Les données de démonstration et les paramètres de la maison (adresse, horaires, frais de collecte, délai d’alerte) sont fictifs ou « à préciser » : à remplacer dans **Gérant → Paramètres**.
