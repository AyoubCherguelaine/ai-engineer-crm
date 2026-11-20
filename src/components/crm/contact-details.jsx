"use client";
import { useState } from "react";
import {
  Plus,
  MessageSquare,
  ExternalLink,
  Trash2,
  Mail,
  Linkedin,
  Pencil,
} from "lucide-react";
import { localDate, formatDate, safeUrl, statuses } from "@/lib/crm-data";
import {
  suggestedActivityStatus,
  addContactActivity,
} from "@/lib/contact-activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { Badge, Avatar, Field, Modal } from "./shared";
export { ContactDetails };

function ContactDetails({
  contact: c,
  company,
  onClose,
  onEdit,
  onDelete,
  onUpdate,
  toast,
}) {
  const [type, setType] = useState("Message sent"),
    [date, setDate] = useState(localDate()),
    [status, setStatus] = useState(() =>
      suggestedActivityStatus("Message sent", c.status),
    ),
    [note, setNote] = useState("");
  function log(e) {
    e.preventDefault();
    onUpdate(addContactActivity(c, { type, date, status, note }));
    setNote("");
    toast("Activity added to your timeline.");
  }
  return (
    <Modal title="Contact details" onClose={onClose} wide>
      <div className="contact-profile">
        <Avatar name={c.name} color={c.color} />
        <div>
          <h2>{c.name}</h2>
          <p>
            {c.role}
            {company ? " at " + company.name : ""}
          </p>
        </div>
        <Button variant="outline" className="button secondary" onClick={onEdit}>
          <Pencil size={15} /> Edit
        </Button>
      </div>
      <div className="details-tags">
        <Badge status={c.status} />
        <span className="tag">{c.temperature} connection</span>
        <span className="tag">{c.opportunity}</span>
      </div>
      <div className="contact-links">
        {c.email && (
          <a href={"mailto:" + c.email}>
            <Mail size={15} />
            {c.email}
          </a>
        )}
        {safeUrl(c.linkedin) && (
          <a href={safeUrl(c.linkedin)} target="_blank" rel="noreferrer">
            <Linkedin size={15} />
            LinkedIn <ExternalLink size={13} />
          </a>
        )}
      </div>
      <div className="detail-dates">
        {[
          ["Last message", c.lastContact],
          ["Reply received", c.replyDate],
          ["Follow-up", c.followUp],
          ["Meeting", c.meetingDate],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{formatDate(value)}</strong>
          </div>
        ))}
      </div>
      {c.notes && (
        <div className="note-box">
          <span className="eyebrow">YOUR NOTES</span>
          <p>{c.notes}</p>
        </div>
      )}
      <h3 className="section-subtitle">Log an activity</h3>
      <form onSubmit={log}>
        <div className="form-grid">
          <Field label="Activity">
            <NativeSelect
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setStatus(suggestedActivityStatus(e.target.value, c.status));
              }}
            >
              {[
                "Message sent",
                "Reply received",
                "Meeting scheduled",
                "Note",
              ].map((t) => (
                <NativeSelectOption key={t}>{t}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Activity date *">
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Contact status after activity *" full>
            <NativeSelect
              required
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((value) => (
                <NativeSelectOption key={value}>{value}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Details" full>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A quick note for your future self…"
            />
          </Field>
        </div>
        <Button className="button primary activity-submit">
          <Plus size={16} />
          Log activity
        </Button>
      </form>
      <h3 className="section-subtitle">Activity timeline</h3>
      <div className="timeline">
        {c.activities.length ? (
          c.activities.map((a) => (
            <div className="timeline-item" key={a.id}>
              <span className="timeline-icon">
                <MessageSquare size={14} />
              </span>
              <div>
                <div className="timeline-item-heading">
                  <strong>{a.type}</strong>
                  <time dateTime={a.date}>
                    {new Date(a.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </time>
                </div>
                {a.status && (
                  <div className="timeline-item-status">
                    <Badge status={a.status} />
                  </div>
                )}
                {a.note && <p>{a.note}</p>}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No activities logged yet. Start with a hello.</p>
        )}
      </div>
      <div className="modal-footer split">
        <Button
          variant="ghost"
          className="text-button danger"
          onClick={onDelete}
        >
          <Trash2 size={15} /> Delete contact
        </Button>
        <Button
          variant="outline"
          className="button secondary"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}
