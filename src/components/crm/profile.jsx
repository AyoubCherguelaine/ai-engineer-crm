"use client";
import { useState } from "react";
import {
  UserRound,
  Download,
  Upload,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { safeUrl } from "@/lib/crm-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { Field } from "./shared";
export { Profile };

function Profile({ profile, onSave, onExport, onImport, onClear, demo }) {
  const [form, setForm] = useState(profile);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE PERSON BEHIND THE CONNECTIONS</div>
          <h1>Your work speaks. Give it a home.</h1>
          <p>A few details to make every introduction feel like you.</p>
        </div>
      </div>
      <div className="profile-layout">
        <Card className="panel">
          <div className="panel-header">
            <h2>My profile & resources</h2>
            <UserRound size={19} />
          </div>
          <form
            className="profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSave({ ...form, name: form.name.trim() });
            }}
          >
            <div className="form-grid">
              {[
                ["name", "Your name", "Ayoub"],
                ["title", "What you do", "AI Engineer"],
                ["portfolio", "Portfolio URL", "https://your-portfolio.com"],
                ["cv", "CV link", "https://…"],
                ["skills", "Your skills", "AI agents, automation, Python…"],
              ].map(([key, label, placeholder]) => (
                <Field key={key} label={label} full={key === "skills"}>
                  <Input
                    required={key === "name"}
                    type={["portfolio", "cv"].includes(key) ? "url" : "text"}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </Field>
              ))}
              <Field label="Open to">
                <NativeSelect
                  value={form.looking}
                  onChange={(e) =>
                    setForm({ ...form, looking: e.target.value })
                  }
                >
                  {[
                    "Part-time & collaboration",
                    "Part-time",
                    "Collaboration",
                    "Freelance",
                    "Full-time",
                  ].map((s) => (
                    <NativeSelectOption key={s}>{s}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field full label="A little about you">
                <Textarea
                  rows={4}
                  placeholder="What do you love building? What could you bring to a team?"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </Field>
            </div>
            <div className="resource-links">
              {[
                ["Portfolio", form.portfolio],
                ["CV", form.cv],
              ].map(
                ([label, url]) =>
                  safeUrl(url) && (
                    <a
                      href={safeUrl(url)}
                      key={label}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open {label}
                      <ExternalLink size={14} />
                    </a>
                  ),
              )}
            </div>
            <Button className="button primary">Save my profile</Button>
          </form>
        </Card>
        <Card className="panel backup-panel">
          <div className="panel-header">
            <h2>Your data, with you.</h2>
            <Download size={19} />
          </div>
          <div className="backup-body">
            <p>
              Everything is saved on your CRM server. Keep a backup of your
              network, notes, and activity.
            </p>
            <Button
              variant="outline"
              className="button secondary"
              onClick={onExport}
            >
              <Download size={17} />
              Export backup
            </Button>
            <Button
              variant="outline"
              className="button secondary"
              onClick={onImport}
            >
              <Upload size={17} />
              Import backup
            </Button>
            <hr />
            <h3>
              {demo ? "Ready to make it yours?" : "Start with a clean slate"}
            </h3>
            <p>
              {demo
                ? "The current records are examples. Clear them when you’re ready to add real connections."
                : "Remove your contacts and companies. Export a backup first if you want to keep them."}
            </p>
            <Button
              variant="ghost"
              className="text-button danger"
              onClick={onClear}
            >
              <Trash2 size={15} />
              {demo ? "Clear demo data" : "Clear workspace"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
