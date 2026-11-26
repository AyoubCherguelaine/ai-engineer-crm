"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeClientWorkspace, validateImport } from "@/lib/crm-data";
import { toast } from "sonner";

const LEGACY_KEY = "reach-crm-v1";

export async function requestCrm(path, options) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
  });
  if (response.status === 401) {
    window.location.assign("/login");
    throw Error("Your session expired. Sign in again.");
  }
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "Could not complete the request.");
    error.status = response.status;
    throw error;
  }
  return body;
}

const requestWorkspace = (options) => requestCrm("/api/workspace", options);

export function useWorkspaceStorage() {
  const [data, setViewData] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(0);
  const [legacyData, setLegacyData] = useState(null);
  const dataRef = useRef(null),
    revision = useRef(0),
    queue = useRef(Promise.resolve()),
    blocked = useRef(false),
    runningAction = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let workspace = await requestWorkspace();
        if (cancelled) return;
        let legacy;
        try {
          const stored = localStorage.getItem(LEGACY_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (validateImport(parsed))
              legacy = normalizeClientWorkspace(parsed);
          }
        } catch {}
        if (legacy && !workspace.initialized) {
          const response = await fetch("/api/workspace", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "If-Match": String(workspace.revision),
            },
            body: JSON.stringify(legacy),
          });
          if (response.ok) {
            workspace = await response.json();
            try {
              localStorage.removeItem(LEGACY_KEY);
            } catch {}
          } else if (response.status === 409) {
            workspace = await requestWorkspace();
            if (!cancelled) setLegacyData(legacy);
          } else {
            const error = await response.json();
            throw Error(
              error.error || "Could not import previous browser records.",
            );
          }
        } else if (legacy && !cancelled) setLegacyData(legacy);
        if (cancelled) return;
        revision.current = workspace.revision;
        dataRef.current = normalizeClientWorkspace(workspace.data);
        setViewData(dataRef.current);
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setData = useCallback((update) => {
    if (runningAction.current) {
      toast.error("Wait for the current workspace action to finish.");
      return Promise.resolve();
    }
    const next = normalizeClientWorkspace(
      typeof update === "function" ? update(dataRef.current) : update,
    );
    dataRef.current = next;
    setViewData(next);
    setPending((count) => count + 1);
    queue.current = queue.current
      .then(async () => {
        if (blocked.current) return;
        try {
          const result = await requestWorkspace({
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "If-Match": String(revision.current),
            },
            body: JSON.stringify(next),
          });
          revision.current = result.revision;
          setSaveError("");
        } catch (error) {
          blocked.current = true;
          setSaveError(error.message);
          toast.error(error.message);
        }
      })
      .finally(() => setPending((count) => count - 1));
    return queue.current;
  }, []);

  const runAction = useCallback(async (path, body, expected) => {
    if (runningAction.current)
      throw new Error("A workspace action is already running.");
    runningAction.current = true;
    setPending((count) => count + 1);
    try {
      await queue.current;
      if (blocked.current)
        throw new Error(
          "Save a backup of your unsaved changes and reload before continuing.",
        );
      const workspace = await requestCrm(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(expected ?? revision.current),
        },
        body: JSON.stringify(body),
      });
      revision.current = workspace.revision;
      dataRef.current = normalizeClientWorkspace(workspace.data);
      setViewData(dataRef.current);
      return workspace;
    } finally {
      runningAction.current = false;
      setPending((count) => count - 1);
    }
  }, []);

  return {
    data,
    setData,
    runAction,
    ready: data !== null,
    saving: pending > 0,
    saveError,
    loadError,
    legacyData,
  };
}
