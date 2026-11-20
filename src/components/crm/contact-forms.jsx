"use client";
import { useState } from "react";

import { statuses, uid } from "@/lib/crm-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { Field, Modal } from "./shared";
const emptyContact = {
  name: "",
  role: "",
  companyId: "",
  email: "",
  linkedin: "",
  status: "Not checked",
  temperature: "Cold",
  channel: "LinkedIn",
  lastContact: "",
  replyDate: "",
  followUp: "",
  meetingDate: "",
  opportunity: "Part-time",
  notes: "",
  activities: [],
  color: "purple",
};

export { ContactForm, CompanyForm };

function ContactForm({ contact, companies, onSave, onClose }) {
  const [form, setForm] = useState(contact || { ...emptyContact });
  const input = (key, props = {}) => (
    <Input
      {...props}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
    />
  );
  return (
    <Modal
      title={contact ? "Edit contact" : "A new connection"}
      subtitle="Every opportunity starts with a person."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, name: form.name.trim(), id: form.id || uid() });
        }}
      >
        <div className="form-grid">
          <Field label="Full name *">
            {input("name", {
              required: true,
              autoFocus: true,
              placeholder: "e.g. Sarah Parker",
              pattern: ".*\\S.*",
            })}
          </Field>
          <Field label="Role / title">
            {input("role", { placeholder: "CEO, CTO, founder…" })}
          </Field>
          <Field label="Company">
            <NativeSelect
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            >
              <NativeSelectOption value="">
                Independent / no company
              </NativeSelectOption>
              {companies.map((c) => (
                <NativeSelectOption value={c.id} key={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Opportunity">
            <NativeSelect
              value={form.opportunity}
              onChange={(e) =>
                setForm({ ...form, opportunity: e.target.value })
              }
            >
              {["Part-time", "Collaboration", "Freelance", "Full-time"].map(
                (s) => (
                  <NativeSelectOption key={s}>{s}</NativeSelectOption>
                ),
              )}
            </NativeSelect>
          </Field>
          <Field label="Email">
            {input("email", {
              type: "email",
              placeholder: "hello@company.com",
            })}
          </Field>
          <Field label="LinkedIn URL">
            {input("linkedin", {
              type: "url",
              placeholder: "https://linkedin.com/in/…",
            })}
          </Field>
          <Field label="Pipeline status">
            <NativeSelect
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statuses.map((s) => (
                <NativeSelectOption key={s}>{s}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Connection">
            <NativeSelect
              value={form.temperature}
              onChange={(e) =>
                setForm({ ...form, temperature: e.target.value })
              }
            >
              <NativeSelectOption>Cold</NativeSelectOption>
              <NativeSelectOption>Warm</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Last message date">
            {input("lastContact", { type: "date" })}
          </Field>
          <Field label="Reply date">
            {input("replyDate", { type: "date" })}
          </Field>
          <Field label="Follow-up date">
            {input("followUp", { type: "date" })}
          </Field>
          <Field label="Meeting date">
            {input("meetingDate", { type: "date" })}
          </Field>
          <Field label="Notes" full>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What do you have in common? What could you help with?"
            />
          </Field>
        </div>
        <div className="modal-footer">
          <Button
            variant="ghost"
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="button primary" type="submit">
            {contact ? "Save changes" : "Add contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function CompanyForm({ company, onSave, onClose }) {
  const [form, setForm] = useState({
    name: "",
    niche: "",
    description: "",
    website: "",
    linkedin: "",
    country: "",
    status: "Not checked",
    color: "green",
    ...company,
  });
  return (
    <Modal
      title={company ? "Edit company" : "Add a company"}
      subtitle="Find teams you would love to build with."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, name: form.name.trim(), id: form.id || uid() });
        }}
      >
        <div className="form-grid">
          {[
            ["name", "Company name *", "e.g. Acme", true],
            ["niche", "Niche", "e.g. AI & automation", false],
            ["country", "Country", "e.g. Algeria", false],
            ["website", "Website", "https://…", false],
            [
              "linkedin",
              "Company LinkedIn URL",
              "https://www.linkedin.com/company/…",
              false,
            ],
          ].map(([key, label, placeholder, required]) => (
            <Field key={key} label={label} full={key === "linkedin"}>
              <Input
                autoFocus={key === "name"}
                required={required}
                pattern={required ? ".*\\S.*" : undefined}
                type={["website", "linkedin"].includes(key) ? "url" : "text"}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Company status" full>
            <NativeSelect
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statuses.map((status) => (
                <NativeSelectOption key={status}>{status}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Description & why you're interested" full>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What do they do, and how could you contribute?"
            />
          </Field>
        </div>
        <div className="modal-footer">
          <Button
            variant="ghost"
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="button primary">Save company</Button>
        </div>
      </form>
    </Modal>
  );
}
