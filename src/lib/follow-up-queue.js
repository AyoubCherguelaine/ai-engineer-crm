import {
  addContactActivity,
  suggestedActivityStatus,
} from "./contact-activity.js";

export function followUpQueue(contacts, today) {
  const active = contacts.filter(({ status }) => status !== "Closed");
  const due = active
    .filter(({ followUp }) => followUp && followUp <= today)
    .sort((a, b) => a.followUp.localeCompare(b.followUp));
  return {
    overdue: due.filter(({ followUp }) => followUp < today),
    today: due.filter(({ followUp }) => followUp === today),
    meetings: active
      .filter(({ meetingDate }) => meetingDate && meetingDate >= today)
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)),
  };
}

export function completeFollowUp(contact, date) {
  const type = "Message sent";
  return {
    ...addContactActivity(contact, {
      type,
      date,
      note: "",
      status: suggestedActivityStatus(type, contact.status),
    }),
    followUp: "",
  };
}
