"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requestCrm } from "@/hooks/use-workspace-storage";
import { MAX_CONTACT_CSV_SIZE } from "@/lib/contact-csv";
import { indexContacts } from "@/lib/contact-matches";
import { Field, Modal } from "./shared";

export function MergeContacts({ contacts, runAction, onClose }) {
  const duplicates = [...indexContacts(contacts).values()].filter(
    (ids) => ids.size > 1,
  );
  const firstPair = [...(duplicates[0] ?? [])];
  const [keepId, setKeep] = useState(firstPair[0] ?? "");
  const [mergeId, setMerge] = useState(firstPair[1] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const label = ({ name, role, email, linkedin, id }) =>
    [name, role, email || linkedin, id].filter(Boolean).join(" · ");
  const select = (value, onChange, excluded) => (
    <NativeSelect
      value={value}
      required
      disabled={busy}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Choose contact</option>
      {contacts
        .filter(({ id }) => id !== excluded)
        .map((contact) => (
          <option key={contact.id} value={contact.id}>
            {label(contact)}
          </option>
        ))}
    </NativeSelect>
  );
  return (
    <Modal title="Merge contacts" wide onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await runAction("/api/contacts/merge", { keepId, mergeId });
            onClose(keepId);
          } catch (error) {
            setError(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {duplicates.length > 0 && (
            <Field label="Suggested duplicates" full>
              <NativeSelect
                disabled={busy}
                value={duplicates.findIndex(
                  (ids) => ids.has(keepId) && ids.has(mergeId),
                )}
                onChange={(event) => {
                  const ids = duplicates[Number(event.target.value)];
                  if (ids) {
                    const [keep, source] = ids;
                    setKeep(keep);
                    setMerge(source);
                  }
                }}
              >
                <option value="-1">Choose manually</option>
                {duplicates.map((ids, i) => (
                  <option key={i} value={i}>
                    {contacts
                      .filter(({ id }) => ids.has(id))
                      .map(({ name }) => name)
                      .join(" / ")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Contact to keep" full>
            {select(keepId, setKeep, mergeId)}
          </Field>
          <Field label="Contact to merge and remove" full>
            {select(mergeId, setMerge, keepId)}
          </Field>
          {[
            ["Keep", contacts.find(({ id }) => id === keepId)],
            ["Merge", contacts.find(({ id }) => id === mergeId)],
          ].map(
            ([label, contact]) =>
              contact && (
                <div
                  key={label}
                  className="grid min-w-0 gap-1 rounded-md border p-2"
                >
                  <p className="font-semibold">
                    {label} {contact.name}
                  </p>
                  <p>{contact.activities.length} activity entries</p>
                  {contact.notes && (
                    <p className="max-h-24 overflow-auto whitespace-pre-wrap break-words">
                      {contact.notes}
                    </p>
                  )}
                </div>
              ),
          )}
          <p className="col-span-full">
            Reach combines notes and activity history, fills empty fields, and
            keeps the selected contact’s other details.
          </p>
          {error && (
            <p className="col-span-full text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button type="submit" disabled={busy || !keepId || !mergeId}>
            Merge contacts
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ImportContacts({ runAction, onClose }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const counts = { create: 0, update: 0, fix: 0 };
  preview?.rows.forEach(({ action }) => counts[action]++);
  const valid = counts.create + counts.update;

  async function loadPreview(source) {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const result = await requestCrm("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: source }),
      });
      setPreview(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Import contacts from CSV"
      wide
      onClose={() => !busy && onClose()}
    >
      <div className="grid gap-3 px-5 py-3">
        <p>
          Use a header row with contact fields such as{" "}
          <code>name,email,linkedin,role</code>. Existing contacts match by
          email or LinkedIn. Blank cells keep existing values.
        </p>
        <Field label="CSV file">
          <Input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files[0];
              setPreview(null);
              setError("");
              setCsv("");
              if (!file) return;
              setBusy(true);
              try {
                if (file.size > MAX_CONTACT_CSV_SIZE)
                  throw new Error("Choose a CSV file no larger than 2 MB.");
                const source = await file.text();
                setCsv(source);
                await loadPreview(source);
              } catch (error) {
                setError(error.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Field>
        {busy && <p role="status">Working…</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {preview && (
          <>
            <p role="status">
              {counts.create} to create · {counts.update} to update ·{" "}
              {counts.fix} to fix
            </p>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr className="border-b align-top" key={row.line}>
                      <td className="p-1">{row.line}</td>
                      <td className="p-1 break-all">{row.name}</td>
                      <td className="p-1">
                        {row.action === "fix"
                          ? `Fix: ${row.message}`
                          : row.action === "update"
                            ? `Update ${row.existingName}`
                            : "Create"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="modal-footer">
        {csv && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => loadPreview(csv)}
          >
            Refresh preview
          </Button>
        )}
        <Button
          disabled={busy || !valid}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await runAction(
                "/api/contacts/import",
                { csv, apply: true },
                preview.revision,
              );
              onClose(valid);
            } catch (error) {
              setError(error.message);
              if (error.status === 409) setPreview(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          Import{" "}
          {valid
            ? `${valid} valid ${valid === 1 ? "row" : "rows"}`
            : "contacts"}
        </Button>
      </div>
    </Modal>
  );
}
