"use client";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/crm-data";

export function Today({ queue, onOpen, onSnooze, onSent, saving }) {
  return (
    <section className="grid gap-5">
      <h1 className="text-3xl font-semibold">Today</h1>
      {[
        [
          "Overdue follow-ups",
          queue.overdue,
          "followUp",
          "No overdue follow-ups.",
        ],
        ["Due today", queue.today, "followUp", "No follow-ups due today."],
        [
          "Upcoming meetings",
          queue.meetings,
          "meetingDate",
          "No upcoming meetings.",
        ],
      ].map(([label, contacts, dateField, empty]) => (
        <section className="panel p-5" key={label}>
          <h2 className="mb-2 text-lg font-semibold">{label}</h2>
          {contacts.length ? (
            <ul className="grid gap-2">
              {contacts.map((contact) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                  key={contact.id}
                >
                  <div>
                    <Button
                      variant="link"
                      className="h-auto p-0 font-semibold"
                      onClick={() => onOpen(contact.id)}
                    >
                      {contact.name}
                    </Button>
                    <p>{formatDate(contact[dateField])}</p>
                  </div>
                  {dateField === "followUp" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => onSnooze(contact.id)}
                      >
                        Snooze to tomorrow
                      </Button>
                      <Button
                        disabled={saving}
                        onClick={() => onSent(contact.id)}
                      >
                        Mark message sent
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>{empty}</p>
          )}
        </section>
      ))}
    </section>
  );
}
