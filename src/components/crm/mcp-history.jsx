"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestCrm } from "@/hooks/use-workspace-storage";
import { Modal } from "./shared";

function display(value) {
  if (value === undefined || value === "") return "—";
  return typeof value === "object"
    ? JSON.stringify(value, null, 2)
    : String(value);
}

export function McpHistory({ runAction }) {
  const [list, setList] = useState(null);
  const [beforeId, setBeforeId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const path = beforeId
      ? `/api/mcp-logs?beforeId=${beforeId}`
      : "/api/mcp-logs";
    requestCrm(path).then(
      (page) => {
        if (active)
          setList((previous) => ({
            ...page,
            data: beforeId
              ? [...(previous?.data ?? []), ...page.data]
              : page.data,
          }));
      },
      (error) => {
        if (active) setError(error.message);
      },
    );
    return () => {
      active = false;
    };
  }, [beforeId]);

  useEffect(() => {
    if (viewing === null) return;
    let active = true;
    requestCrm(`/api/mcp-logs/${viewing}`).then(
      (log) => {
        if (active) setDetail(log);
      },
      (error) => {
        if (active) setDetailError(error.message);
      },
    );
    return () => {
      active = false;
    };
  }, [viewing]);

  return (
    <section className="grid gap-4">
      <h1 className="text-3xl font-semibold">MCP history</h1>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {list ? (
        list.data.length ? (
          <ul className="grid gap-2">
            {list.data.map(({ id, tool, recordId, createdAt }) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-semibold">{tool.replaceAll("_", " ")}</p>
                  <p className="break-all text-sm">
                    {recordId} · {new Date(createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetail(null);
                    setDetailError("");
                    setViewing(id);
                  }}
                >
                  View edit
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No MCP edits yet.</p>
        )
      ) : (
        !error && <p role="status">Loading MCP edits…</p>
      )}
      {list?.nextBeforeId && (
        <div>
          <Button
            variant="outline"
            disabled={list.nextBeforeId === beforeId}
            onClick={() => {
              setError("");
              setBeforeId(list.nextBeforeId);
            }}
          >
            Load older edits
          </Button>
        </div>
      )}
      {viewing !== null && (
        <Modal title="MCP edit" wide onClose={() => !busy && setViewing(null)}>
          <div className="grid max-h-[55vh] gap-3 overflow-auto px-5 py-2">
            {detailError && (
              <p role="alert" className="text-destructive">
                {detailError}
              </p>
            )}
            {!detail && !detailError && <p role="status">Loading edit…</p>}
            {detail && (
              <>
                <p>
                  {detail.tool.replaceAll("_", " ")} · Revision{" "}
                  {detail.revision}
                </p>
                {detail.undoneRevision ? (
                  <p>Undone in revision {detail.undoneRevision}.</p>
                ) : (
                  detail.superseded && (
                    <p>
                      A later edit changed an affected record. Undo is
                      unavailable.
                    </p>
                  )
                )}
                {detail.changes ? (
                  detail.changes.map(({ recordId, fields, before, after }) => (
                    <section key={recordId} className="grid gap-2">
                      <h2 className="break-all font-semibold">{recordId}</h2>
                      {before === null && (
                        <p>Undo will remove this created record.</p>
                      )}
                      {after === null && (
                        <p>Undo will restore this removed record.</p>
                      )}
                      {fields.map((field) => (
                        <div
                          key={field}
                          className="grid gap-1 rounded-md border p-2"
                        >
                          <h3 className="font-medium">{field}</h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <strong>Before</strong>
                              <pre className="whitespace-pre-wrap break-all">
                                {display(before?.[field])}
                              </pre>
                            </div>
                            <div>
                              <strong>After</strong>
                              <pre className="whitespace-pre-wrap break-all">
                                {display(after?.[field])}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  ))
                ) : (
                  <p>
                    This earlier edit recorded only field names.{" "}
                    {detail.fields.join(", ")}.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <Button
              disabled={
                !detail?.changes ||
                !!detail.undoneRevision ||
                detail.superseded ||
                busy
              }
              onClick={async () => {
                setBusy(true);
                setDetailError("");
                try {
                  await runAction(
                    `/api/mcp-logs/${viewing}`,
                    {},
                    detail.workspaceRevision,
                  );
                  setViewing(null);
                } catch (error) {
                  setDetailError(
                    error.status === 409
                      ? `${error.message} Close and reopen this edit to refresh.`
                      : error.message,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Undo edit
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
