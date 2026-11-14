# StuPro — Mon agenda d'études

Site perso (PWA) pour voir d'un coup d'œil ses **examens**, **devoirs** et **séances d'étude**, avec **notifications** et **synchronisation** téléphone ↔ laptop.

- Vite + JavaScript (sans framework)
- Supabase : connexion par e-mail, base de données, temps réel
- Notifications push via une Edge Function Supabase + `pg_cron`
- Hébergement : Vercel

> Sans configuration Supabase, l'app tourne en **mode démo** : tout est enregistré dans le navigateur.

## Lancer en local

```bash
npm install
npm run dev
```

## 1. Projet Supabase

Projet : `fusysqjailouuippexln`. L'URL et la clé publique sont déjà dans `.env.production` / `.env.development`.

1. **SQL Editor** → colle et exécute `supabase/migrations/001_init.sql` (ré-exécutable sans risque).
2. **Authentication → URL Configuration** : mets l'URL du site (ex. `https://stupro.vercel.app`) dans *Site URL*, et ajoute `http://localhost:5173` dans *Redirect URLs*.
3. (Conseillé, pour l'app installée sur iPhone) **Authentication → Email Templates → Magic Link** : ajoute `{{ .Token }}` dans le texte pour recevoir aussi un code à 6 chiffres.

## 2. Notifications push

```bash
npx web-push generate-vapid-keys
```

- Mets la **clé publique** dans `.env.local` → `VITE_VAPID_PUBLIC_KEY`.
- Déploie la fonction et ses secrets (avec la [CLI Supabase](https://supabase.com/docs/guides/cli)) :

```bash
supabase login
supabase link --project-ref <ref-du-projet>
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:toi@exemple.com CRON_SECRET=<un-mot-de-passe-long>
supabase functions deploy send-reminders --no-verify-jwt
```

- **Database → Extensions** : active `pg_cron` et `pg_net`, puis dans le SQL Editor :

```sql
select cron.schedule(
  'stupro-reminders', '* * * * *',
  $$ select net.http_post(
       url := 'https://<ref-du-projet>.supabase.co/functions/v1/send-reminders',
       headers := '{"x-cron-secret": "<le-meme-CRON_SECRET>"}'::jsonb
     ) $$
);
```

- Dans l'app : **Réglages → Activer les notifications**, sur chaque appareil.
  - **iPhone** : ouvre le site dans Safari → Partager → *Sur l'écran d'accueil*, puis active les notifications depuis l'app installée (iOS 16.4+).
  - **Laptop** : Chrome/Edge proposent « Installer l'application » dans la barre d'adresse.

## 3. Déployer sur Vercel

1. Importe le repo sur [vercel.com](https://vercel.com) (preset **Vite** détecté automatiquement).
2. Aucune variable à ajouter : `.env.production` est déjà dans le repo.
3. Deploy, puis mets l'URL Vercel dans Supabase (étape 1.2).

## Structure

```
src/main.js              navigation + onglets
src/store.js             données (Supabase ou mode démo) + temps réel
src/views/               calendar, tasks, settings, login
src/components/          formulaire d'ajout, carte, toast
src/notifications.js     permission, abonnement push, rappels locaux
public/sw.js             service worker (affiche les notifications)
supabase/                migration SQL + Edge Function send-reminders
```
