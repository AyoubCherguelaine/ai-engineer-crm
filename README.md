# Reach — personal outreach CRM

A Next.js CRM for Ayoub’s part-time and collaboration search. Track contacts, companies, messages, replies, follow-ups, and meetings through the app or an authenticated JSON API and MCP tools.

## Run locally

Requires **Node.js 22+**. Local SQLite development needs a writable disk; Netlify deployments use Turso.

```sh
npm install
npm run dev
```

Open http://localhost:5173 and sign in with `CRM_USERNAME` and `CRM_PASSWORD` from `.env`. A local `.env` has been generated for this checkout. Edit its credentials if you want different ones, then restart the server. Credentials and database files are ignored by Git.

For a fresh checkout, copy `.env.example` to `.env` and fill in:

| Variable             | Purpose                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| `CRM_USERNAME`       | The single user's login name; also used for API authentication.                       |
| `CRM_PASSWORD`       | Login/API password.                                                                   |
| `SESSION_SECRET`     | At least 32 random characters to sign sessions. Generate with `openssl rand -hex 32`. |
| `CRM_API_TOKEN`      | Dedicated MCP/REST bearer key; use at least 32 random characters.                     |
| `CRM_DB_PATH`        | Local SQLite file location, default `data/reach.sqlite`. Ignored in Turso mode.       |
| `TURSO_DATABASE_URL` | Remote Turso libSQL URL; leave empty with the token for local development.            |
| `TURSO_AUTH_TOKEN`   | Private read/write database token; required with the remote URL.                      |
| `CRM_REQUIRE_TURSO`  | Set `true` on Netlify to prevent temporary local storage.                             |

```sh
npm run build
npm start
```

Sessions last eight hours. Signing out clears the browser session; changing the username, password, or session secret invalidates existing sessions. Login attempts are limited to ten failures per fifteen minutes per server process. Use HTTPS when hosting this app beyond localhost, including when sending API credentials.

## Netlify deployment

Use **Turso for persistent database storage**. [docs/NETLIFY.md](docs/NETLIFY.md) covers database creation, environment variables, safe migration of existing records, and deployment checks. `netlify.toml` supplies the build settings.

```sh
# After setting TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env:
npm run db:migrate:turso
npm run db:check
```

The migration saves a backup and refuses to overwrite an initialized destination. No cloud database is created or connected until you provide its credentials.

## Your workflow

1. Open **My profile & resources** and add your skills, portfolio URL, and shareable CV link.
2. Add companies with their niche, country, LinkedIn, website, and description.
3. Add people and link them to companies. Both contacts and companies default to **Not checked**. Change their status from the edit form.
4. Open a contact to log a message, reply, meeting, or note. Choose the **Activity date** and **Contact status after activity**. The activity type suggests a status, which you can override. Each new timeline entry keeps its selected status and full date, even when the contact status changes later.
5. Set follow-up dates. Due and overdue follow-ups appear on the overview.
6. Adapt and copy a message draft. Send it through your own email or LinkedIn.
7. Use **Refresh workspace** to load changes made through the API or another browser.

## MCP access for LLM clients

A token-authenticated Streamable HTTP MCP server runs at **`http://localhost:5173/api/mcp`**. A dedicated `CRM_API_TOKEN` has been generated in `.env`. LLM clients can search, create, read, and update contacts/companies, read your profile, and log dated activities with explicit statuses.

See **[docs/MCP.md](docs/MCP.md)** for Codex and Copilot connection examples, all ten tools, argument examples, token rotation, deployment, and the read-only `npm run mcp:check` connection check. [public/llms.txt](public/llms.txt) is also served at `/llms.txt` for discovery.

## JSON API

All contact/company reads and writes require authentication. Scripts can use **`Authorization: Bearer <CRM_API_TOKEN>`** or **HTTP Basic auth with the `.env` username/password**. Browser requests use the login session cookie. Responses are never cached. Cross-origin browser mutations are rejected; no public CORS access is enabled.

| Method | Path                  | Result                                                             |
| ------ | --------------------- | ------------------------------------------------------------------ |
| GET    | `/api/contacts`       | List contacts; optional `q` and `status` query parameters.         |
| POST   | `/api/contacts`       | Create a contact. Only `name` is required.                         |
| GET    | `/api/contacts/{id}`  | Read one contact.                                                  |
| PATCH  | `/api/contacts/{id}`  | Update only supplied fields.                                       |
| DELETE | `/api/contacts/{id}`  | Delete one contact.                                                |
| GET    | `/api/companies`      | List companies; optional `q` and `status` query parameters.        |
| POST   | `/api/companies`      | Create a company. Only `name` is required.                         |
| GET    | `/api/companies/{id}` | Read one company.                                                  |
| PATCH  | `/api/companies/{id}` | Update only supplied fields.                                       |
| DELETE | `/api/companies/{id}` | Delete a company; keep its contacts and clear their company links. |

Export `CRM_USERNAME` and `CRM_PASSWORD` in the shell before running these examples. The example IDs are optional; omit `id` to generate a UUID.

```sh
# Push a company
curl --user "$CRM_USERNAME:$CRM_PASSWORD" http://localhost:5173/api/companies \
  -H 'Content-Type: application/json' \
  -d '{"id":"acme","name":"Acme","niche":"AI","country":"Algeria","linkedin":"https://www.linkedin.com/company/acme/"}'

# Push a contact, linked to that company
curl --user "$CRM_USERNAME:$CRM_PASSWORD" http://localhost:5173/api/contacts \
  -H 'Content-Type: application/json' \
  -d '{"id":"sarah","name":"Sarah","role":"CTO","companyId":"acme"}'

# Read all contacts
curl --user "$CRM_USERNAME:$CRM_PASSWORD" http://localhost:5173/api/contacts

# Read one company
curl --user "$CRM_USERNAME:$CRM_PASSWORD" http://localhost:5173/api/companies/acme

# Update the contact
curl --user "$CRM_USERNAME:$CRM_PASSWORD" -X PATCH http://localhost:5173/api/contacts/sarah \
  -H 'Content-Type: application/json' \
  -d '{"status":"Warm","replyDate":"2026-11-20","notes":"Interested in a collaboration."}'

# Update the company
curl --user "$CRM_USERNAME:$CRM_PASSWORD" -X PATCH http://localhost:5173/api/companies/acme \
  -H 'Content-Type: application/json' \
  -d '{"status":"To reach out","country":"France"}'

# Filter by status
curl --user "$CRM_USERNAME:$CRM_PASSWORD" --get http://localhost:5173/api/contacts \
  --data-urlencode 'status=Not checked'
```

Single-record responses are `{ "data": { ... }, "revision": 1 }`. Lists return `{ "data": [...], "total": 1, "revision": 1 }`. Creation returns `201`; reads/updates return `200`. Errors return `{ "error": "..." }` with `400` for malformed JSON, `401` for missing/invalid credentials, `403` for a foreign origin, `404` for unknown IDs, `409` for a duplicate ID or revision conflict, `413` for bodies over 5 MB, `415` for missing JSON content type, `422` for invalid fields, `429` for repeated login failures, or `503` for missing auth configuration.

Supported statuses for both record types: `Not checked`, `To reach out`, `No response`, `Warm`, `Meeting`, `Closed`.

Contact fields: `name`, `role`, `companyId`, `email`, `linkedin`, `status`, `temperature` (`Cold` or `Warm`), `channel` (`LinkedIn`, `Email`, `Other`), `lastContact`, `replyDate`, `followUp`, `meetingDate`, `opportunity` (`Part-time`, `Collaboration`, `Freelance`, `Full-time`), `notes`, `activities`, `color`. Dates use `YYYY-MM-DD` or an empty string. Activities contain `id`, `type` (`Message sent`, `Reply received`, `Meeting scheduled`, `Note`), `date`, `note`, and an optional `status` snapshot. Older entries without status remain supported. If you patch activities, send the whole desired activity array. API patches change only explicitly supplied fields; set status and dates together when logging outreach from a script.

Company fields: `name`, `niche`, `description`, `country`, `website`, `linkedin`, `status`, `color`. Colors: `purple`, `orange`, `blue`, `green`, `pink`, `teal`. A contact's nonempty `companyId` must refer to an existing company. IDs cannot be changed by PATCH. Unknown fields and invalid dates/URLs are rejected.

Responses include the workspace revision. To guard an API mutation against concurrent updates, pass the revision as `If-Match: "12"`. A stale revision returns `409`. This is optional on record endpoints. The UI always uses it, so an older browser snapshot cannot overwrite a newer API change. On a conflict, export any unsaved changes, then refresh the workspace.

The app uses `GET /api/workspace` for the full `{data, revision, initialized}` snapshot and `PUT /api/workspace` for validated backup replacement. PUT requires an `If-Match` revision and accepts the full workspace as its JSON body. `POST /api/auth/login` accepts `{username,password}` and sets an HttpOnly, SameSite session cookie. `POST /api/auth/logout` clears it.

## Storage, migration, and backups

The UI, API, and MCP share one workspace: a remote Turso database when configured, or the existing local SQLite file for development. A fresh server starts with an empty network. On the first login, a valid previous `reach-crm-v1` browser workspace is migrated automatically **only if the server has not been initialized**. The old browser copy is removed only after the server confirms the import. If the server already has data, the previous browser workspace is retained and can be downloaded from **My profile & resources**. Existing backups without company status/country/LinkedIn fields remain supported; company status defaults to **Not checked**.

Use **Export backup** and **Import backup** in the profile. Restoring a backup replaces the server workspace for every session. CVs remain links rather than uploaded files, and message drafts remain temporary.

This is a single-user app. Netlify/function deployments must configure Turso; missing remote credentials produce `503` instead of silently using a temporary file. A conventional single server can still use local SQLite with persistent disk. See [the deployment guide](docs/NETLIFY.md). To back up the raw database while running, use SQLite's online backup mechanism; to copy it as a file, stop the app first. JSON export works while running.

## Structure and checks

- `src/app/`: App Router pages, login, and route handlers.
- `src/components/crm/`: workspace, forms, activity details, profile, and templates.
- `src/components/ui/`: shadcn/ui primitives.
- `src/hooks/use-workspace-storage.js`: server loading, legacy migration, and serialized revision-checked saves.
- `src/server/`: authentication, asynchronous Turso/local SQLite persistence, validation, shared CRM services, REST handlers, and MCP tools.
- `src/lib/crm-data.js`: record helpers, statuses, and legacy backup compatibility.
- `tests/server.test.mjs`: authentication, validation, CRUD, atomicity, persistence, and conflict checks using a temporary database.

```sh
npm test
npm run build
```

Stack: Next.js App Router, React 19, shadcn/ui, Tailwind CSS 4, Turso/libSQL or local SQLite, Zod, Sonner, and Lucide.
