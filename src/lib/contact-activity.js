import { uid } from "./crm-data.js";

export function suggestedActivityStatus(type, currentStatus) {
  if (
    type === "Message sent" &&
    ["Not checked", "To reach out"].includes(currentStatus)
  )
    return "No response";
  if (
    type === "Reply received" &&
    ["Not checked", "To reach out", "No response"].includes(currentStatus)
  )
    return "Warm";
  if (type === "Meeting scheduled") return "Meeting";
  return currentStatus;
}

export function addContactActivity(contact, { type, date, status, note }) {
  const updated = {
    ...contact,
    status,
    activities: [
      { id: uid(), type, date, status, note },
      ...contact.activities,
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
  if (type === "Message sent")
    updated.lastContact =
      contact.lastContact && contact.lastContact > date
        ? contact.lastContact
        : date;
  if (type === "Reply received") {
    updated.replyDate =
      contact.replyDate && contact.replyDate > date ? contact.replyDate : date;
    updated.temperature = "Warm";
  }
  if (type === "Meeting scheduled") updated.meetingDate = date;
  return updated;
}
