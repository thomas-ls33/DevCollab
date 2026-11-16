# DevCollab — Frontend web

Application web React + TypeScript (Vite) de la plateforme DevCollab : projets open source, demandes de contribution, pull requests, reviews de code avec commentaires de ligne, profils développeurs, abonnements et fil d'activité.

## Démarrage

```bash
npm install
cp .env.example .env
npm run dev
```

## Deux modes

| Variable | Rôle |
|---|---|
| `VITE_USE_MOCK=true` | Mode démo : API et authentification simulées dans le navigateur (localStorage). Compte `demo` / `demo1234`, code de confirmation `123456`. |
| `VITE_USE_MOCK=false` | Mode réel : Cognito + API Gateway. |
| `VITE_API_URL` | URL du stage API Gateway, ex. `https://gn25if1p83.execute-api.us-east-1.amazonaws.com/prod` |
| `VITE_COGNITO_USER_POOL_ID` | `us-east-1_KCLNd779Y` |
| `VITE_COGNITO_CLIENT_ID` | `1join4nr6ei0uafqfc3pai2mt2` |

Le bouton « Mode démo ↺ » dans la barre du haut réinitialise les données simulées.

## Authentification

Inscription, confirmation par code e-mail et connexion via `amazon-cognito-identity-js`. Le jeton **ID** Cognito est envoyé dans l'en-tête `Authorization` de chaque requête (attendu par l'autorisateur Cognito `autorisation` de l'API Gateway).

## Contrat d'API attendu par le frontend

Les réponses peuvent être l'objet JSON directement ou enveloppées dans `{ "data": ... }`. Les erreurs : `{ "message": "..." }` avec un code HTTP adapté.

| Lambda | Méthode | Route |
|---|---|---|
| utilisateurs | GET / PUT | `/users/me` |
| | GET | `/users?q=&skill=` |
| | GET | `/users/{id}` |
| | POST / DELETE | `/users/{id}/follow` |
| | GET | `/users/{id}/followers`, `/users/{id}/following` |
| projets | GET / POST | `/projects?q=&tech=&ownerId=` |
| | GET / PUT / DELETE | `/projects/{id}` |
| | GET / POST | `/projects/{id}/contributions` |
| | PUT | `/projects/{id}/contributions/{cid}` `{ status }` |
| pull-requests | GET / POST | `/pull-requests?projectId=&authorId=&status=` |
| | GET / PUT | `/pull-requests/{id}` |
| reviews | GET / POST | `/reviews?pullRequestId=` |
| activite | GET | `/activity?userId=&projectId=` |

Les formes exactes des objets (User, Project, PullRequest, Review, Activity…) sont dans `src/api/types.ts`. L'implémentation simulée `src/api/mockApi.ts` sert de référence pour les règles métier (seul le propriétaire merge, on ne s'approuve pas soi-même, une PR mergée est figée, etc.).

CORS doit être activé sur l'API Gateway pour l'origine du site, avec l'en-tête `Authorization` autorisé.

## Build et déploiement

```bash
npm run build
```

Le dossier `dist/` est un site statique (S3 + CloudFront, Amplify Hosting…). Le routage étant côté client, configurer `index.html` comme document d'erreur / fallback.

## Structure

```
src/
  api/          types, client REST, implémentation simulée
  auth/         Cognito, auth simulée, contexte React
  components/   layout, diff viewer, fil d'activité, UI
  pages/        écrans de l'application
```
