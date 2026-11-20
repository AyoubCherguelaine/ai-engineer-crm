# Deploy Reach on Netlify with Turso

Reach supports a remote **Turso libSQL database** for Netlify and a local SQLite file for development. The UI, REST API, and MCP tools share the selected database. Existing login and MCP credentials keep working.

The repository includes `netlify.toml`, database configuration, a connection check, and a migration command. Creating the Turso database and configuring your Netlify account require your own credentials; neither service is provisioned by changing the code.

## 1. Create a Turso libSQL database

Create a database in your Turso account. Use the **libSQL / `@libsql/client` compatible database**, with a `libsql://` URL. This app does not use the newer `turso://` engine, embedded replicas, or local-to-cloud sync.

Using the [Turso CLI](https://docs.turso.tech/cli/db/create):

```sh
turso auth login
turso db create reach-crm
# Display the database URL.
turso db show --url reach-crm
# Generate a read/write database token.
turso db tokens create reach-crm
```

A database can also be created in Turso's dashboard. Copy its libSQL URL and a read/write database token into your local `.env`:

```dotenv
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-private-database-token
```

These credentials are different from `CRM_API_TOKEN`, which authenticates LLM clients to Reach. Only the Reach server needs the Turso token. Do not use a `NEXT_PUBLIC_` prefix or commit either token.

The two Turso variables must be set together. An incomplete or invalid configuration causes an error; it never falls back to a local database. Non-loopback HTTP URLs, file URLs, credentials embedded in URLs, and query parameters disabling TLS are rejected.

## 2. Move your existing local records

Skip migration if you want an empty cloud workspace.

Before copying records, stop the local app so new writes cannot be missed. Keep `CRM_DB_PATH` pointing at your original SQLite file, and set the two Turso variables above.

```sh
# Default source: CRM_DB_PATH, or data/reach.sqlite.
npm run db:migrate:turso

# Or specify the source file explicitly.
npm run db:migrate:turso -- /absolute/path/to/reach.sqlite
```

The command:

1. Reads and validates the existing workspace without changing the source file.
2. Saves a private, UI-compatible JSON backup under `backups/`.
3. Connects to Turso and creates the schema if needed.
4. Copies contacts, companies, profile, notes, dates, statuses, and activity history only if the destination has never been initialized.
5. Checks that the copied data matches the source snapshot.

A populated or previously initialized destination is refused, including a previously cleared workspace. There is no automatic overwrite or force flag. A conditional update also prevents overwriting a destination that another instance initializes while migration is running. Rerunning a successful migration will be refused rather than duplicating or replacing records.

Keep the original SQLite file and the JSON backup until you have checked the deployed app. `backups/` is ignored by Git. If migration reports a network error after an ambiguous write, inspect the destination with `npm run db:check` before retrying.

Alternatively, export a JSON backup from the local app before switching storage, then import it through the deployed app's profile. Import explicitly replaces the destination workspace, so review that confirmation carefully.

## 3. Verify the database connection

From the repository:

```sh
npm run db:check
```

With the Turso variables set, the output must show `"storage": "turso"` and the expected record counts. It does not print tokens or record contents. A first connection creates the schema and an uninitialized empty workspace if the database is new.

Then check the app locally against that same remote database:

```sh
npm run dev
```

When both Turso variables are present, local development also uses Turso. To return to an independent local SQLite workspace, leave both Turso variables blank and set `CRM_REQUIRE_TURSO=false`. This does not sync or delete either database.

## 4. Configure Netlify

Import the Git repository in Netlify. The included configuration sets:

- Build command: `npm run build`
- Publish directory: `.next`
- Node version: 22

Netlify supplies its maintained Next.js/OpenNext adapter automatically. Do not use a static HTML export: login, the API, and MCP require the Next.js server routes. See [Netlify's Next.js setup documentation](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Set these variables in Netlify's project environment settings for the production deployment:

| Variable             | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL` | Your Turso libSQL database URL.                                               |
| `TURSO_AUTH_TOKEN`   | Your private read/write Turso database token.                                 |
| `CRM_REQUIRE_TURSO`  | `true`                                                                        |
| `CRM_USERNAME`       | Your desired login username.                                                  |
| `CRM_PASSWORD`       | Your login password.                                                          |
| `SESSION_SECRET`     | The existing session secret, or a new random value of at least 32 characters. |
| `CRM_API_TOKEN`      | The existing MCP/REST bearer token, or a newly generated integration key.     |

Make the variables available to the **Functions runtime**, and to builds as appropriate for your Netlify settings. Local `.env` is ignored by Git and is not automatically uploaded. Variables declared only in `netlify.toml` are not runtime function secrets; use the Netlify UI, CLI, or API. [Netlify's environment-variable documentation](https://docs.netlify.com/build/functions/environment-variables/)

### Mark sensitive variables as secrets

In Netlify, open **Project configuration → Environment variables**. For each of the following variables, select **Options → Edit**, enable **Contains secret values**, and save:

- `CRM_PASSWORD`
- `SESSION_SECRET`
- `CRM_API_TOKEN`
- `TURSO_AUTH_TOKEN`

Use the **Production** deploy context and ensure the variables are available to the **Functions** runtime. If importing `.env` in the UI, import first, then edit these four variables to enable the secret flag. This is a Netlify account setting; naming a variable in `.env` or `netlify.toml` does not set it. Once flagged, secret values become write-only for protected contexts. [Netlify Secrets Controller](https://docs.netlify.com/build/environment-variables/secrets-controller/)

`CRM_DB_PATH` is not used in Turso mode. The app also detects Netlify/AWS function environments and refuses local fallback if Turso credentials are absent. A `503` configuration error is preferable to losing records in a temporary filesystem.

### Build reports `CRM_USERNAME` or `CRM_DB_PATH` as exposed

These are non-secret configuration values: a login identifier and the local SQLite path. Their values can legitimately occur in repository examples and fallback settings. The included `netlify.toml` sets `SECRETS_SCAN_OMIT_KEYS=CRM_USERNAME,CRM_DB_PATH` to exclude only those keys from value scanning. Passwords, session secrets, MCP keys, and Turso tokens remain scanned. Do not add those credentials to this exception or disable secret scanning. [Netlify scanning configuration](https://docs.netlify.com/build/environment-variables/secrets-controller/)

Push the configuration change and redeploy. `CRM_DB_PATH` can also be removed from Netlify's environment settings because Turso mode does not use it. The four sensitive variables listed above should remain marked **Contains secret values**.

Use production-scoped credentials for production. For deploy previews, configure a separate Turso database if you want a working preview. Otherwise leave its database credentials unset; the data endpoints will report `503` rather than create local storage. Sharing production credentials with a preview makes the preview read and write production records.

## 5. Deploy and verify

Deploy the project, then:

1. Sign in with the configured username/password.
2. Check company/contact counts and existing activity history.
3. Create a test record, reload, and verify it persists.
4. Verify it is also readable through the API or MCP.

A local machine with your server's `CRM_API_TOKEN` configured can check the deployed MCP endpoint:

```sh
npm run mcp:check -- https://your-site.netlify.app/api/mcp
```

Update LLM client URLs from localhost to `https://your-site.netlify.app/api/mcp`. Keep using the **CRM** bearer token, not the Turso database token. The endpoint and all ten tool names are unchanged. See [MCP.md](MCP.md).

Redeploy after changing Netlify environment values. Migrating storage does not itself publish the site or configure cloud credentials.

## Storage behavior and verification limits

Remote requests use `@libsql/client/web` over HTTP(S); they do not create a local database, download a replica, or use writable disk. Local mode uses `@libsql/client/node`, with the existing SQLite file format and workspace table preserved. `better-sqlite3` is no longer a dependency.

Connections are cached per configuration. Schema initialization is idempotent. Updates use an atomic `UPDATE ... WHERE revision = ?` compare-and-swap operation. A supplied stale revision returns `409`; operations without a supplied revision retry conflicts against fresh data a bounded number of times. This preserves unrelated changes and concurrent activity appends across independent function instances.

Automated tests cover local storage, migration, concurrent writes, fail-closed configuration, authentication failures, and the official remote HTTP client against a loopback libSQL protocol fixture. Those tests do not replace connecting to your actual Turso account. Run `npm run db:check` with your real credentials before deploying.
