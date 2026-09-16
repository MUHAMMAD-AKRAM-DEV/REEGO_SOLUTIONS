# REEGO_SOLUTIONS

**Billing Agency Operations Platform** — centralized operations platform for a 50-person medical billing agency, replacing
Microsoft Excel as the coordination layer for billing work and provider
credentialing.

**Scope:** operations, documents, credentialing and visibility. Staff continue to
work claims inside each client's own practice-management system. This platform
deliberately does **not** do charge entry, coding, claim scrubbing, EDI 837
submission, ERA posting, or patient statements.

**[USER-GUIDE.md](USER-GUIDE.md)** — how the agency's staff use the system.
**[DEPLOYMENT.md](DEPLOYMENT.md)** — how to run it, and what is still outstanding
before real patient data goes in.

Full proposal, including phasing and open questions:
<https://claude.ai/code/artifact/7f48f2b8-c63f-4263-8825-afdbe305a6c8>

## Status

| Phase | Scope | State |
|---|---|---|
| 00 | Auth, RBAC, audit log, client / provider / payer registry | Done, with create and edit forms |
| 01 | Documents — upload, versioning, audited download | Done |
| 02 | Credentialing and payer enrollment, expirables dashboard | Done |
| 03 | Work queues — AR buckets, denials, assignment, SLA | Done |
| — | Spreadsheet import (clients, providers, credentials) | Done |
| 04 | Dashboards, productivity, QA audits | Not started |
| 05 | Client-facing portal | Not started |

All screens render against a live database with seeded demo data. Sorting,
filtering and search are verified working.

## Stack

- **Next.js 16** (App Router) + TypeScript — one codebase for the internal app
  and the client portal, split by role
- **PostgreSQL 17** + **Prisma 7** with the `@prisma/adapter-pg` driver adapter
- **Tailwind 4**
- Self-hosted session auth — bcrypt passwords, hashed session tokens, TOTP MFA
  columns in place for enrolment

## Running it locally

```bash
cp .env.example .env.local
```

Edit `.env.local` and set two things:

- `SEED_ADMIN_PASSWORD` — the seed script refuses to run without it and will
  not invent a default
- `DATABASE_URL` — point it at whichever Postgres you are using

**Either** use the bundled container, which needs Docker Desktop running:

```bash
npm run db:up
```

**Or** use a Postgres you already have. Create a database and set the URL to
match, for example:

```bash
psql -U postgres -c "CREATE DATABASE medcred;"
```

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/medcred?schema=public"
```

Then, either way:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

`db:seed` creates the first admin account, a reference payer list, and one
fictional demo client with two providers so the registry screens have something
to render. Delete the demo client before real practices go in.

## Frontend

Hand-built components rather than a component library, so the product does not
read as a generic admin template.

**Palette** carries over from the build proposal — verdigris `#0d5f5a` on cool
paper — so the document and the product look like one system. Red, ochre and
green are reserved for severity and are never used decoratively; the accent
never means "urgent".

**Type** is IBM Plex: Sans for interface, Mono for every identifier, date and
count (tabular figures matter when scanning a column of NPIs), Serif for page
titles only — one characterful face, used once per screen.

**The severity stripe** is the signature. Every row that can need attention
carries a three-pixel coloured edge, and the same four-value scale drives the
status pills. It is why a provider with no NPI recorded reads as amber at a
glance without anyone having to look at the NPI column.

Both light and dark themes are defined token-level. Branded surfaces use
separate `--brand` tokens that hold their colour in both themes — a brand slab
that inverts to bright mint on a dark ground glares.

Nav lists the modules that ship in later phases, greyed with their phase
number, so the shape of the product is visible and nobody wonders where AR
follow-up went.

## Project layout

```
prisma/
  schema.prisma        Domain model — phase 00 tables, enums shaped for later phases
  seed.ts              Admin account, payer reference data, demo client
  migrations/          Initial migration, generated from the schema
prisma.config.ts       Prisma 7 CLI config — connection URL lives here, not in the schema
src/lib/
  db.ts                PrismaClient singleton with the pg driver adapter
  auth.ts              Passwords, session tokens, login with lockout
  rbac.ts              Capability-based permission checks
  audit.ts             Append-only audit log writer
  validation.ts        Zod schemas, including the NPI check-digit test
  table.ts             Shared search / filter / sort / paginate from the URL
  storage.ts           File storage behind a driver interface (disk now, S3 later)
src/app/
  login/               Sign-in screen and auth server actions
  (app)/               Authenticated shell — sidebar, top bar
    overview/          Book-of-business counts and recent activity
    clients/           Client list and detail
    providers/         List, full provider profile, create and edit
    payers/            Shared payer registry
    credentialing/     Expirables across every provider
    enrollment/        Provider x payer enrollment pipeline
    documents/         Upload and filing
    queues/            Work queues, AR buckets, assignment
    audit/             Append-only audit log viewer
  api/documents/[id]/  Audited download route — never served statically
src/components/
  ui.tsx               Severity system, panels, tables, buttons
  sidebar.tsx          Section navigation
docker-compose.yml     Local Postgres
```

## Design notes worth knowing before you extend it

**Audit log is append-only.** `AuditLog` has no `updatedAt` and application code
never updates or deletes rows. A later migration should revoke `UPDATE` and
`DELETE` on that table from the application database role, so the guarantee is
enforced by Postgres rather than by convention. `READ` is an audited action —
under HIPAA, who *looked* at PHI matters as much as who changed it.

**Providers are not unique on NPI.** The same physician can legitimately appear
under two client practices, and each of those relationships is credentialed and
enrolled separately. NPI is indexed, not constrained.

**Payers are global, not per-client.** Duplicating them per client would break
denial-trend aggregation across the book of business.

**Permissions are capabilities, not roles.** Call sites ask
`can(user, "provider.manage")`, never `user.role === "MANAGER"`. Adding a role
is then one edit in `src/lib/rbac.ts`.

**Client-portal users need two checks.** A capability check alone does not stop
one portal user reading another practice's data — every client-scoped query must
also pass `canReachClient(user, clientId)`.

**Session tokens are stored hashed.** The raw token exists only in the user's
cookie, so a database leak yields no usable sessions. Absolute lifetime is 12
hours with no idle extension.

**Nothing sensitive goes in `AuditLog.metadata`.** It holds changed field names
and request context, never raw PHI.

## How the modules fit together

**Documents** are attached to a client, a provider, or both. Uploading a
replacement creates a new version and chains it to the old one rather than
overwriting — "what did the certificate say last year" is a real audit
question. Files are never served statically: every download goes through
`/api/documents/[id]`, which checks the session, enforces client scope, and
writes an audit entry before returning a byte.

**Credentialing** is one table for everything with an expiry date — licences,
DEA, board certification, malpractice cover, CAQH attestation. One table
rather than one per type, because the operational question is always the same:
what lapses next, and for whom. Severity thresholds are 30 and 90 days, chosen
because under 30 days there is no longer time to get most renewals processed.

**Enrollment** is one row per provider per payer per location, moving through
a pipeline from not started to effective. Only `APPROVED` and `EFFECTIVE` mean
the provider can actually be billed for, which is why the "billable" count is
separate from the total.

**Work queues** hold AR follow-up, denials, charge entry and credentialing
tasks. AR aging buckets are stored rather than recomputed, because the industry
works in those buckets and every report needs them.

**Import** matches spreadsheet headings loosely rather than demanding a
template — "Provider NPI", "NPI" and "Individual NPI" all map to the same
field, because the agency's sheets were not written against our schema. Every
row is validated before anything is written, and the preview shows exactly
which rows will be skipped and why. The commit runs in one transaction.

**Calendar dates are stored at UTC midnight** and rendered with an explicit
UTC timezone. Expiry, issue and start dates carry no time of day, and building
them at local midnight silently shifts them a day when serialised — which is
exactly the kind of error nobody notices until a licence looks like it expired
a day early.

**Lists share one implementation** of search, filter, sort and pagination in
`src/lib/table.ts`. State lives in the URL, so a filtered view is a link that
can be pasted to a colleague. Sort keys are whitelisted per page — a key from
the query string is never passed to the database without appearing in that
page's allowed list.

## Not yet done

- `taxIdEncrypted` on `Client` is a plain column awaiting the application-layer
  encryption helper — do not put a real tax ID in it yet
- TOTP MFA enrolment and challenge flow (columns exist, flow does not)
- Database-level revoke of `UPDATE`/`DELETE` on `AuditLog`
- File storage writes to local disk; production needs the S3 driver
- The document upload and spreadsheet upload forms have not been exercised
  through a real browser file picker — the parsing and validation behind them
  is tested, the file-input plumbing is not
- No Excel import for payer enrollments yet (clients, providers and credentials
  are covered)
- MFA enrolment flow
