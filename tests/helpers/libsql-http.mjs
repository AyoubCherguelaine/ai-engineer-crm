// A loopback Hrana v2 fixture backed by real SQLite. It exercises the official
// HTTP client's encoding/authentication, without using any cloud credentials.
import { createServer } from "node:http";
import { createClient } from "@libsql/client/node";
import { pathToFileURL } from "node:url";

const emptyResult = { cols: [], rows: [], affected_row_count: 0 };
const encode = (value) =>
  value === null
    ? { type: "null" }
    : typeof value === "number"
      ? {
          type: Number.isInteger(value) ? "integer" : "float",
          value: Number.isInteger(value) ? String(value) : value,
        }
      : { type: "text", value: String(value) };
const decode = (value) =>
  value.type === "null"
    ? null
    : value.type === "integer" || value.type === "float"
      ? Number(value.value)
      : value.value;
function resultSet(result) {
  return {
    cols: result.columns.map((name) => ({ name })),
    rows: result.rows.map((row) =>
      result.columns.map((name) => encode(row[name])),
    ),
    affected_row_count: result.rowsAffected,
    ...(result.lastInsertRowid === undefined
      ? {}
      : { last_insert_rowid: String(result.lastInsertRowid) }),
  };
}
export async function startLibsqlHttpFixture(path, token) {
  const client = createClient({
    url: pathToFileURL(path).href,
    intMode: "number",
  });
  let requests = 0,
    unavailable = false;
  const server = createServer(async (req, res) => {
    if (unavailable) {
      res.writeHead(503);
      res.end("Fixture unavailable");
      return;
    }
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }
    if (req.url !== "/v2/pipeline") {
      res.writeHead(404);
      res.end();
      return;
    }
    requests++;
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body),
        sqls = new Map();
      const statement = (stmt) => ({
        sql: stmt.sql ?? sqls.get(stmt.sql_id),
        args: (stmt.args || []).map(decode),
      });
      const results = [];
      for (const request of payload.requests) {
        let response;
        if (request.type === "close") response = { type: "close" };
        else if (request.type === "store_sql") {
          sqls.set(request.sql_id, request.sql);
          response = { type: "store_sql" };
        } else if (request.type === "close_sql")
          response = { type: "close_sql" };
        else if (request.type === "execute")
          response = {
            type: "execute",
            result: resultSet(await client.execute(statement(request.stmt))),
          };
        else if (request.type === "batch") {
          const steps = request.batch.steps;
          const queries = steps
            .map((step, index) => ({ index, stmt: statement(step.stmt) }))
            .filter(
              ({ stmt }) => !/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(stmt.sql),
            );
          const queryResults = await client.batch(
            queries.map((q) => q.stmt),
            "write",
          );
          const stepResults = steps.map((step) =>
            /^\s*ROLLBACK\b/i.test(statement(step.stmt).sql)
              ? null
              : emptyResult,
          );
          queries.forEach((query, index) => {
            stepResults[query.index] = resultSet(queryResults[index]);
          });
          response = {
            type: "batch",
            result: {
              step_results: stepResults,
              step_errors: steps.map(() => null),
            },
          };
        } else throw Error("Unsupported fixture operation: " + request.type);
        results.push({ type: "ok", response });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ baton: null, results }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    get requests() {
      return requests;
    },
    setUnavailable(value) {
      unavailable = value;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      client.close();
    },
  };
}
