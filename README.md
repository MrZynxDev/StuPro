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

## 1. Supabase — déjà configuré ✅

Projet `fusysqjailouuippexln` (URL, clé publique et clé VAPID publique dans `.env.production`).

- Tables `items`, `subjects`, `push_subscriptions` + RLS + temps réel (`supabase/migrations/001_init.sql`, ré-exécutable).
- Edge Function `send-reminders` déployée, secrets VAPID / `CRON_SECRET` enregistrés côté Supabase.
- `pg_cron` appelle la fonction chaque minute (job `stupro-reminders`).
- Auth : e-mail + mot de passe, sans e-mail de confirmation (`mailer_autoconfirm`). *Site URL* = `http://localhost:5173` et `https://*.vercel.app` autorisé.

**Après le déploiement Vercel** : Authentication → URL Configuration → mets l'URL Vercel dans *Site URL*.

> Le modèle d'e-mail (texte français, code à 6 chiffres) n'est modifiable qu'avec un SMTP personnalisé ou un plan payant.

## 2. Notifications

Dans l'app : **Réglages → Activer les notifications**, sur chaque appareil.
- **iPhone** : Safari → Partager → *Sur l'écran d'accueil*, puis active les notifications depuis l'app installée (iOS 16.4+).
- **Laptop** : Chrome/Edge proposent « Installer l'application » dans la barre d'adresse.

## 3. Déployer sur Vercel

1. Importe le repo sur [vercel.com](https://vercel.com) (preset **Vite** détecté automatiquement).
2. Aucune variable à ajouter : `.env.production` est déjà dans le repo.
3. Deploy, puis mets l’URL Vercel comme *Site URL* dans Supabase (voir étape 1).

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
