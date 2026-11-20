"use client";
import { useState } from "react";
import { Sprout, LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui/card";

export function LoginForm({ configured }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fields.get("username"),
          password: fields.get("password"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Could not sign in.");
      window.location.assign("/");
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <ThemeToggle className="login-theme-toggle" />
      <Card className="login-card">
        <a className="brand" href="/login">
          <span className="brand-icon">
            <Sprout size={24} />
          </span>
          reach<span className="brand-period">.</span>
        </a>
        <span className="eyebrow">YOUR PERSONAL OUTREACH SPACE</span>
        <h1>A little closer to your next chapter.</h1>
        <p>Sign in to your connections, conversations, and opportunities.</p>
        {!configured ? (
          <div role="alert" className="error-banner">
            Set CRM_USERNAME, CRM_PASSWORD, and SESSION_SECRET (at least 32
            characters) in your server’s .env file, then restart the app.
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="field">
              <span>Username</span>
              <Input
                name="username"
                autoComplete="username"
                required
                autoFocus
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                disabled={busy}
              />
            </label>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <Button type="submit" className="button primary" disabled={busy}>
              {busy ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <LockKeyhole size={17} />
              )}{" "}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
        <span className="login-footnote">Small steps. Real opportunities.</span>
      </Card>
    </main>
  );
}
