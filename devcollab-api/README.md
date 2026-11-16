# DevCollab — API REST (AWS Lambda + API Gateway + RDS PostgreSQL)

Backend serverless de DevCollab : 5 fonctions Lambda Python derrière l'API Gateway `devcollab-api`, authentification Amazon Cognito et base PostgreSQL sur RDS. Il correspond au contrat attendu par le frontend `devcollab-web`.

## Arborescence

```
sql/schema.sql            schéma PostgreSQL (14 tables)
common/                   code partagé : connexion BDD, routage, validation, auth, requêtes
functions/<nom>/          une Lambda par domaine métier (lambda_function.py)
openapi.yaml              documentation Swagger + configuration importable dans API Gateway
scripts/build.sh          génère dist/devcollab-<nom>.zip
scripts/deploy.sh         déploie les Lambdas et l'API Gateway via AWS CLI
scripts/init_db.py        crée le schéma dans la base
scripts/local_server.py   lance l'API en local sur http://localhost:3001
tests/                    tests pytest sur une vraie base PostgreSQL
```

| Lambda | Routes |
|---|---|
| `devcollab-utilisateurs` | `/users`, `/users/me`, `/users/{id}`, `/users/{id}/follow`, `/users/{id}/followers`, `/users/{id}/following` |
| `devcollab-projets` | `/projects`, `/projects/{id}`, `/projects/{id}/contributions`, `/projects/{id}/contributions/{cid}` |
| `devcollab-pull-requests` | `/pull-requests`, `/pull-requests/{id}` |
| `devcollab-reviews` | `/reviews`, `/reviews/{id}` |
| `devcollab-activite` | `/activity` (lecture seule) |

La documentation complète (paramètres, corps, réponses, codes d'erreur) est dans `openapi.yaml` : ouvrir le fichier dans https://editor.swagger.io.

## Règles métier

- Le profil utilisateur est créé automatiquement à la première requête authentifiée (id = `sub` Cognito).
- Projets : nom unique (insensible à la casse) ; seul le propriétaire modifie, supprime et traite les demandes de contribution.
- Contributions : une seule demande en attente par utilisateur et par projet ; accepter ajoute l'utilisateur aux contributeurs.
- Pull requests : ouvertes uniquement par le propriétaire ou un contributeur ; titre/description modifiables par l'auteur ; fermer/rouvrir par l'auteur ou le propriétaire ; merger par le propriétaire seul ; une PR mergée est définitive.
- Reviews : uniquement sur une PR ouverte ; l'auteur ne peut que commenter sa propre PR ; les commentaires de ligne doivent viser un fichier de la PR.
- Chaque action importante alimente la table `activities`, lue par `devcollab-activite`.

Erreurs renvoyées sous la forme `{ "message": "..." }` avec 400, 401, 403, 404, 405, 409 ou 500.

## 1. Préparer la base

Ouvrir le port 5432 du groupe de sécurité `devcollab-db-sg` pour votre IP, puis :

```bash
cp .env.example .env
pip install -r requirements-dev.txt
python scripts/init_db.py
```

`DB_NAME` doit valoir `devcollab` (nom réel de la base RDS). `deploy.sh` corrige automatiquement la variable `DB_NAME=devcollab-db` des Lambdas.

## 2. Déployer (Learner Lab démarré)

Copier les identifiants temporaires depuis « AWS Details » > « AWS CLI » dans `~/.aws/credentials`, puis :

```bash
./scripts/deploy.sh
```

Le script :
1. construit les 5 zips (code + driver `pg8000`, 100 % Python, compatible avec tout runtime Python 3) ;
2. met à jour le code de chaque Lambda, son handler (`lambda_function.lambda_handler`), un timeout de 15 s et `DB_NAME` ;
3. autorise API Gateway à invoquer les Lambdas ;
4. importe `openapi.yaml` dans `devcollab-api` (mode overwrite : routes, intégrations proxy, autorisateur Cognito, réponses CORS) ;
5. déploie le stage `prod`.

L'import recrée l'autorisateur Cognito sous le nom `cognito` à partir du User Pool `us-east-1_KCLNd779Y` : c'est normal.

Variables surchargeables : `AWS_REGION`, `API_ID`, `STAGE`, `COGNITO_USER_POOL_ID`, `DB_NAME_VALUE`.

### Réseau

- Lambdas **hors VPC** (par défaut) : la base doit être accessible publiquement et `devcollab-db-sg` doit autoriser le port 5432 depuis Internet (`0.0.0.0/0`), car les IP des Lambdas changent.
- Lambdas **dans le VPC** `vpc-0fd7adcb17f5cf245` : autoriser dans `devcollab-db-sg` le groupe de sécurité des Lambdas sur le port 5432.

### Connexion SSL

RDS PostgreSQL impose SSL par défaut. `DB_SSL=require` (défaut) chiffre la connexion ; `DB_SSL=verify` + `DB_SSL_CA=chemin/global-bundle.pem` vérifie aussi le certificat ; `DB_SSL=disable` pour une base locale.

## 3. Brancher le frontend

Dans `devcollab-web/.env` :

```
VITE_USE_MOCK=false
VITE_API_URL=https://gn25if1p83.execute-api.us-east-1.amazonaws.com/prod
```

## Développement local

```bash
python scripts/local_server.py
```

L'API répond sur `http://localhost:3001` avec la base définie dans `.env`. Le serveur local décode le jeton Cognito **sans vérifier sa signature** : il ne doit jamais être exposé. Mettre `VITE_API_URL=http://localhost:3001` côté frontend.

## Tests

Ils recréent le schéma à chaque test : utiliser une base dédiée, jamais la base RDS.

```bash
createdb devcollab_test
DB_HOST=localhost DB_NAME=devcollab_test DB_USER=postgres DB_PASSWORD=... DB_SSL=disable pytest
```

## Logs

Chaque fonction écrit ses erreurs dans CloudWatch Logs, groupe `/aws/lambda/devcollab-<nom>`.
