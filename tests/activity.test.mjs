import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addContactActivity,
  suggestedActivityStatus,
} from "../src/lib/contact-activity.js";

const contact = {
  id: "activity-person",
  name: "Sarah",
  status: "Warm",
  temperature: "Cold",
  lastContact: "2026-11-18",
  replyDate: "",
  meetingDate: "",
  activities: [],
};

test("chosen status and date are recorded even when the activity suggests another status", () => {
  const updated = addContactActivity(contact, {
    type: "Reply received",
    date: "2026-11-12",
    status: "Closed",
    note: "Not available this quarter.",
  });
  assert.equal(updated.status, "Closed");
  assert.equal(updated.replyDate, "2026-11-12");
  assert.equal(updated.activities[0].date, "2026-11-12");
  assert.equal(updated.activities[0].status, "Closed");
  assert.equal(contact.activities.length, 0);
  const next = addContactActivity(updated, {
    type: "Note",
    date: "2026-11-20",
    status: "To reach out",
    note: "Revisit next quarter.",
  });
  assert.equal(next.activities[1].status, "Closed");
});

test("backdated messages keep the latest contact date while retaining the activity date", () => {
  const updated = addContactActivity(contact, {
    type: "Message sent",
    date: "2026-11-10",
    status: "No response",
    note: "",
  });
  assert.equal(updated.lastContact, "2026-11-18");
  assert.equal(updated.activities[0].date, "2026-11-10");
  assert.equal(
    suggestedActivityStatus("Message sent", "Not checked"),
    "No response",
  );
  assert.equal(suggestedActivityStatus("Meeting scheduled", "Warm"), "Meeting");
});
