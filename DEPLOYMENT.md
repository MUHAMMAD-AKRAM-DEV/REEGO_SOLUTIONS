# Deployment

## Read this first

**This application is not yet ready to hold real patient or provider data.**

The build is complete and works, but several controls that a system holding
protected health information needs are not finished. They are listed under
[Before real data goes in](#before-real-data-goes-in) below, and none of them
are large. Until they are done, use the system with test data only.

That is a statement about readiness, not about quality — the gaps are known,
deliberate and enumerated rather than discovered later.

---

## What the system needs to run

| | |
|---|---|
| Node | 24 or later |
| PostgreSQL | 15 or later (17 recommended) |
| Storage | A writable directory, or S3 once the driver is written |
| TLS | Required in production — session cookies are `secure` outside development |

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Use TLS in production. |
| `UPLOAD_DIR` | no | Where documents are written. Defaults to `.uploads`. Must persist across deploys. |
| `SEED_ADMIN_EMAIL` | first run | Used once to create the first administrator. |
| `SEED_ADMIN_PASSWORD` | first run | Used once. Change it immediately after first sign-in. |
| `NODE_ENV` | yes | `production` in production. Controls cookie security and logging. |

Never commit a filled `.env.local`. `.gitignore` already excludes `.env*`.

---

## Option 1 — Docker

The included `Dockerfile` produces a standalone image that runs as a non-root
user and carries its own health check.

```bash
docker build -t billing-ops .
```

```bash
docker run -d --name billing-ops -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/medcred?sslmode=require" \
  -e NODE_ENV=production \
  -e UPLOAD_DIR=/data/uploads \
  -v billing-ops-uploads:/data/uploads \
  billing-ops
```

Run migrations as a release step, not on container start — two containers
starting at once must not both try to migrate:

```bash
docker run --rm -e DATABASE_URL="..." billing-ops npx prisma migrate deploy
```

## Option 2 — A Linux server directly

```bash
git clone <your-repo-url> && cd medical-credential
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm run db:seed          # first deploy only
NODE_ENV=production node .next/standalone/server.js
```

Put it behind nginx or Caddy terminating TLS, and run it under systemd or pm2
so it restarts on failure.

## Option 3 — AWS, which is what the proposal assumed

- **App**: ECS Fargate or App Runner from the Docker image
- **Database**: RDS PostgreSQL, encryption at rest on, automated backups on
- **Files**: S3 with SSE — needs the S3 driver in `src/lib/storage.ts`
- **Secrets**: Secrets Manager or SSM Parameter Store, never environment files
  baked into an image
- **Sign a BAA with AWS** before any real data is loaded

Deliberately **not** Vercel for the app tier: a business associate agreement is
enterprise-tier only there, and PHI makes that a hard requirement.

---

## First run

```bash
npx prisma migrate deploy
npm run db:seed
```

`db:seed` creates the administrator, a reference payer list, and one fictional
demo practice. **Delete the demo client and change the seeded password before
anyone else signs in.**

`npm run db:seed:modules` adds demo credentials, enrollments and work items.
Do not run it on a production database.

## Health check

`GET /api/health` returns `200` when the app can reach its database and `503`
when it cannot. Point the load balancer at it. It deliberately reveals nothing
else.

---

## Before real data goes in

Each of these is small on its own. Together they are the difference between a
working application and one that should hold patient data.

| # | What | Why it matters |
|---|---|---|
| 1 | **Finish MFA.** The `mfaSecret` and `mfaEnrolledAt` columns exist; the enrolment and challenge flow does not. | Password-only access to PHI is the single biggest gap. |
| 2 | **Encrypt `Client.taxIdEncrypted`.** It is currently a plain column with a misleading name. | A tax ID in plaintext is exactly what a breach notification is about. |
| 3 | **Write the S3 storage driver.** `src/lib/storage.ts` is already behind an interface — only the three functions change. | Local disk does not survive a container restart and is not encrypted at rest. |
| 4 | **Revoke `UPDATE` and `DELETE` on `AuditLog`** from the application database role. | The log is append-only by convention today; it should be by permission. |
| 5 | **Automated backups with a tested restore.** | An untested backup is not a backup. |
| 6 | **Sign a BAA** with the hosting provider. | Legally required before a vendor may process PHI on your behalf. |
| 7 | **Rate-limit the login route** at the edge. | Account lockout protects one account; it does not stop spraying across many. |
| 8 | **Set a retention policy** for audit entries and documents. | Keeping everything forever is its own liability. |

## Operational notes

**Sessions last 12 hours** with no idle extension. Shorten it in
`src/lib/auth.ts` if the agency's policy requires.

**Deactivating a user does not revoke their live sessions** automatically.
Call `revokeAllSessionsFor(userId)` when someone leaves.

**Nothing is ever hard-deleted** — clients offboard, providers deactivate,
credentials retire, documents version. Anyone expecting a delete button should
be told why there isn't one.

**Uploads must be on persistent storage.** If `UPLOAD_DIR` points at container
filesystem, every document is lost on the next deploy.
