"use client";

import { X } from "lucide-react";
import { initials } from "@/lib/crm-data";
import { Button } from "@/components/ui/button";

import { Badge as StatusBadge } from "@/components/ui/badge";
import { Avatar as AvatarRoot, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export { Badge, Avatar, Field, Modal };

function Badge({ status }) {
  return (
    <StatusBadge
      variant="secondary"
      className={"badge status-" + status.toLowerCase().replaceAll(" ", "-")}
    >
      <span />
      {status}
    </StatusBadge>
  );
}
function Avatar({ name, color = "purple", small = false }) {
  return (
    <AvatarRoot className={`avatar ${color} ${small ? "small" : ""}`}>
      <AvatarFallback className="bg-transparent text-inherit">
        {initials(name)}
      </AvatarFallback>
    </AvatarRoot>
  );
}
function Field({ label, children, full = false }) {
  return (
    <label className={"field " + (full ? "full" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, subtitle, children, onClose, wide = false }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={wide ? "modal wide" : "modal"}
        showCloseButton={false}
      >
        <DialogHeader className="modal-head">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={subtitle ? undefined : "sr-only"}>
              {subtitle || "Manage your outreach workspace."}
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
