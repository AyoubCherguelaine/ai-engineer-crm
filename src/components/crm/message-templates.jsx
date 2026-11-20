"use client";
import { useState } from "react";
import { CalendarDays, MessageSquare, Send, Pencil, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

import { Field } from "./shared";
export { Templates };

function Templates({ profile, toast }) {
  const [recipient, setRecipient] = useState(""),
    [company, setCompany] = useState(""),
    [edits, setEdits] = useState({});
  const name = recipient || "[First name]",
    team = company || "[Company]",
    me = profile.name || "[Your name]";
  const templates = [
    {
      title: "The first hello",
      tag: "COLD OUTREACH",
      icon: Send,
      text: `Hi ${name},\n\nI’m ${me}, ${profile.title || "an AI engineer"}. I came across ${team} and would love to learn more about what you’re building.\n\nI work on ${profile.skills || "[your skills]"} and I’m currently open to ${(profile.looking || "part-time and collaboration").toLowerCase()}. Is there a project where I could help?\n\n${profile.portfolio ? "A few things I’ve built: " + profile.portfolio : "[Add your portfolio link]"}\n${profile.cv ? "My CV: " + profile.cv + "\n" : ""}\nHappy to share more if it sounds useful.\n${me}`,
    },
    {
      title: "A thoughtful follow-up",
      tag: "KEEP IT MOVING",
      icon: MessageSquare,
      text: `Hi ${name},\n\nJust following up on my last message about working with ${team}. I know things get busy, so no rush.\n\nI’d still love to explore how I could contribute. Happy to start with a small project if that helps.\n\nThanks for your time,\n${me}`,
    },
    {
      title: "Let’s have a conversation",
      tag: "THE NEXT STEP",
      icon: CalendarDays,
      text: `Hi ${name},\n\nThanks for getting back to me! I’d love to hear more about the team and what you have in mind.\n\nWould you be open to a quick 15-minute call this week? Let me know a time that works for you.\n\nLooking forward to it,\n${me}`,
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A STARTING POINT, IN YOUR OWN WORDS</div>
          <h1>Less overthinking. More hellos.</h1>
          <p>
            Make it personal. These drafts use the details from your profile.
          </p>
        </div>
      </div>
      <div className="template-personalize">
        <Field label="Recipient’s first name">
          <Input
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setEdits({});
            }}
            placeholder="e.g. Sarah"
          />
        </Field>
        <Field label="Company">
          <Input
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setEdits({});
            }}
            placeholder="e.g. Acme"
          />
        </Field>
        <span>
          <Pencil size={16} />
          Personalize a detail before you send.
        </span>
      </div>
      <div className="templates-grid">
        {templates.map((t) => (
          <Card className="panel template-card" key={t.title}>
            <div className="template-icon">
              <t.icon size={21} />
            </div>
            <span className="eyebrow">{t.tag}</span>
            <h2>{t.title}</h2>
            <Textarea
              aria-label={t.title + " draft"}
              value={edits[t.title] ?? t.text}
              onChange={(e) =>
                setEdits({ ...edits, [t.title]: e.target.value })
              }
            />
            <Button
              variant="outline"
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(edits[t.title] ?? t.text);
                  toast(
                    "Message copied. Add your personal touch before sending.",
                  );
                } catch {
                  toast("Select the draft text and copy it with Ctrl+C.");
                }
              }}
            >
              <Copy size={16} />
              Copy message
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
