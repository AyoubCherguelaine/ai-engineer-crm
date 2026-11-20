"use client";
import { useRef, useState } from "react";
import {
  Plus,
  Search,
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  UserRound,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  X,
  CalendarDays,
  MessageSquare,
  Send,
  Clock3,
  Download,
  ExternalLink,
  Linkedin,
  MapPin,
  Trash2,
  Sprout,
  Menu,
  CircleHelp,
  BriefcaseBusiness,
  CheckCheck,
  Pencil,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  statuses,
  localDate,
  formatDate,
  validateImport,
  safeUrl,
  normalizeClientWorkspace,
} from "@/lib/crm-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Card } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge, Avatar, Modal } from "./shared";
import { ContactForm, CompanyForm } from "./contact-forms";
import { ContactDetails } from "./contact-details";
import { Profile } from "./profile";
import { Templates } from "./message-templates";
import { useWorkspaceStorage } from "@/hooks/use-workspace-storage";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
const navItems = [
  ["Overview", LayoutDashboard],
  ["Contacts", Users],
  ["Companies", Building2],
  ["Message templates", FileText],
];

export default App;

function App() {
  const { data, setData, ready, saveError, saving, loadError, legacyData } =
    useWorkspaceStorage();
  const [page, setPage] = useState("Overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All contacts"),
    [view, setView] = useState("list"),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [mobileNav, setMobileNav] = useState(false);
  const importRef = useRef(null);
  if (loadError)
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Could not load your workspace</h1>
          <p role="alert">{loadError}</p>
          <Button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  if (!ready) return <WorkspaceSkeleton />;
  const contact = data.contacts.find((c) => c.id === selected);
  const companyOf = (c) => data.companies.find((co) => co.id === c.companyId);
  const updateContact = (c) =>
    setData((d) => ({
      ...d,
      contacts: d.contacts.map((x) => (x.id === c.id ? c : x)),
    }));
  const navigate = (p) => {
    setPage(p);
    setQuery("");
    setFilter("All contacts");
    setMobileNav(false);
  };
  const filtered = data.contacts.filter(
    (c) =>
      (filter === "All contacts" || c.status === filter) &&
      `${c.name} ${c.role} ${companyOf(c)?.name || ""} ${c.opportunity}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const today = localDate();
  const followups = data.contacts
    .filter((c) => c.followUp && c.followUp <= today && c.status !== "Closed")
    .sort((a, b) => a.followUp.localeCompare(b.followUp));
  const meetings = data.contacts
    .filter(
      (c) => c.meetingDate && c.meetingDate >= today && c.status === "Meeting",
    )
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  const messaged = data.contacts.filter((c) => c.lastContact).length,
    replied = data.contacts.filter((c) => c.replyDate).length;
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `reach-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Your backup has been exported.");
  }
  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error("Please choose a backup smaller than 5 MB.");
      const parsed = JSON.parse(await file.text());
      if (!validateImport(parsed))
        throw Error("This file is not a valid Reach backup.");
      setModal({ type: "import", data: normalizeClientWorkspace(parsed) });
    } catch (err) {
      toast(
        err instanceof SyntaxError
          ? "Could not read this JSON backup."
          : err.message,
      );
    }
    e.target.value = "";
  }
  const addContact = () => setModal({ type: "contact" });
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobileNav ? "is-open" : "")}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-icon">
            <Sprout size={24} />
          </span>
          reach<span className="brand-period">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">A</span>
          <div>
            <strong>Personal workspace</strong>
            <span>Let’s build your next chapter</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(([name, Icon]) => (
            <Button
              variant="ghost"
              key={name}
              className={page === name ? "nav-item active" : "nav-item"}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              {name}
              {name === "Contacts" && (
                <span className="nav-count">{data.contacts.length}</span>
              )}
            </Button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-spark">✳</div>
          <h3>
            Small steps.
            <br />
            Real opportunities.
          </h3>
          <p>A thoughtful message today could be your next big thing.</p>
          <Button variant="ghost" onClick={addContact}>
            Make a connection <Plus size={16} />
          </Button>
        </div>
        <div className="sidebar-bottom">
          <Button
            variant="ghost"
            className={"nav-item " + (page === "My profile" ? "active" : "")}
            onClick={() => navigate("My profile")}
          >
            <UserRound size={19} />
            My profile & resources
          </Button>
          <Button
            variant="ghost"
            className="nav-item"
            onClick={() => setModal({ type: "help" })}
          >
            <CircleHelp size={19} />A little help
          </Button>
          <div className="sidebar-user">
            <Avatar name={data.profile.name || "Ayoub"} color="green" small />
            <div>
              <strong>{data.profile.name || "Ayoub"}</strong>
              <span>{data.profile.title || "Your personal workspace"}</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobileNav && (
        <Button
          variant="ghost"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              variant="ghost"
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </Button>
            <span>My workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Refresh workspace"
              title="Refresh workspace"
              disabled={saving}
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={17} />
            </Button>
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              disabled={saving}
              onClick={async () => {
                try {
                  const response = await fetch("/api/auth/logout", {
                    method: "POST",
                  });
                  if (!response.ok) throw Error();
                  window.location.assign("/login");
                } catch {
                  toast.error("Could not sign out. Please try again.");
                }
              }}
            >
              <LogOut size={17} />
            </Button>
            <span className="local-indicator">
              <span />
              {saveError ? "Not saved" : saving ? "Saving…" : "Saved to server"}
            </span>
            <Button
              variant="ghost"
              className="icon-button profile-icon"
              aria-label="Open your profile"
              onClick={() => navigate("My profile")}
            >
              <Avatar name={data.profile.name || "Ayoub"} color="green" small />
            </Button>
          </div>
        </header>
        <div className="page-content">
          {saveError && (
            <div className="error-banner">
              {saveError} Export a backup of any unsaved changes before
              reloading.
            </div>
          )}
          {(page === "Overview" || page === "Contacts") && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR PERSONAL OUTREACH SPACE</div>
                  <h1>
                    {page === "Overview"
                      ? "Connections today. Possibilities tomorrow."
                      : "Good people. New possibilities."}
                  </h1>
                  <p>
                    {page === "Overview"
                      ? `A little consistency goes a long way, ${data.profile.name || "Ayoub"}. Let’s make your next move.`
                      : "The founders, builders, and teams you want to work with."}
                  </p>
                </div>
                <Button className="button primary" onClick={addContact}>
                  <Plus size={17} />
                  Add contact
                </Button>
              </div>
              <div className="stats-grid">
                {[
                  {
                    label: "People in your network",
                    value: data.contacts.length,
                    icon: Users,
                    foot: `${data.contacts.filter((c) => !c.lastContact).length} waiting for your first hello`,
                    color: "purple",
                  },
                  {
                    label: "People reached",
                    value: messaged,
                    icon: Send,
                    foot: "Connections you’ve reached out to",
                    color: "blue",
                  },
                  {
                    label: "Warm conversations",
                    value: data.contacts.filter(
                      (c) => c.status === "Warm" || c.status === "Meeting",
                    ).length,
                    icon: MessageSquare,
                    foot: messaged
                      ? `${Math.round((replied / messaged) * 100)}% reply rate · keep it personal`
                      : "Your next conversation starts here",
                    color: "orange",
                  },
                  {
                    label: "Meetings lined up",
                    value: meetings.length,
                    icon: CalendarDays,
                    foot: meetings[0]
                      ? `Next one on ${formatDate(meetings[0].meetingDate)}`
                      : "Good conversations open doors",
                    color: "green",
                  },
                ].map((s) => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <span className={"stat-icon " + s.color}>
                        <s.icon size={17} />
                      </span>
                    </div>
                    <strong className="stat-value">
                      {String(s.value).padStart(2, "0")}
                    </strong>
                    <span className="stat-foot">{s.foot}</span>
                  </div>
                ))}
              </div>
              {page === "Overview" && (
                <div className="focus-strip">
                  <span className="focus-icon">
                    <Sprout size={24} />
                  </span>
                  <div>
                    <strong>
                      Build relationships, not just a contact list.
                    </strong>
                    <p>
                      You’re looking for{" "}
                      <b>
                        {(
                          data.profile.looking || "part-time & collaboration"
                        ).toLowerCase()}
                      </b>
                      . A personal hello is a great place to start.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("Message templates")}
                  >
                    Find the right words <ChevronRight size={17} />
                  </Button>
                </div>
              )}
              <div
                className={
                  "workspace-grid " + (page === "Contacts" ? "full-width" : "")
                }
              >
                <Card className="panel contacts-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <h2>Your connections</h2>
                      <span className="number-pill">
                        {data.contacts.length}
                      </span>
                    </div>
                    <div className="panel-tools">
                      <Button
                        variant="ghost"
                        title="Export your data"
                        aria-label="Export your data"
                        className="icon-button"
                        onClick={exportData}
                      >
                        <Download size={17} />
                      </Button>
                      <div className="view-switch">
                        <Button
                          variant="ghost"
                          aria-label="List view"
                          className={view === "list" ? "selected" : ""}
                          onClick={() => setView("list")}
                        >
                          <Users size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label="Pipeline view"
                          className={view === "board" ? "selected" : ""}
                          onClick={() => setView("board")}
                        >
                          <LayoutDashboard size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="pipeline-tabs">
                    <Button
                      variant="ghost"
                      className={filter === "All contacts" ? "selected" : ""}
                      onClick={() => setFilter("All contacts")}
                    >
                      All contacts <span>{data.contacts.length}</span>
                    </Button>
                    {statuses
                      .filter((status) => status !== "Closed")
                      .map((s) => (
                        <Button
                          variant="ghost"
                          key={s}
                          className={filter === s ? "selected" : ""}
                          onClick={() => setFilter(s)}
                        >
                          {s}
                          <span>
                            {data.contacts.filter((c) => c.status === s).length}
                          </span>
                        </Button>
                      ))}
                  </div>
                  <div className="table-toolbar">
                    <div className="search-input">
                      <Search size={17} />
                      <Input
                        aria-label="Search contacts"
                        placeholder="Search people, companies, or roles…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <Button
                          variant="ghost"
                          className="icon-button"
                          onClick={() => setQuery("")}
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                    <NativeSelect
                      className="filter-select"
                      aria-label="Filter by status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <NativeSelectOption>All contacts</NativeSelectOption>
                      {statuses.map((s) => (
                        <NativeSelectOption key={s}>{s}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  {view === "list" ? (
                    <div className="table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PERSON</TableHead>
                            <TableHead>COMPANY</TableHead>
                            <TableHead>STATUS</TableHead>
                            <TableHead>LAST MESSAGE</TableHead>
                            <TableHead aria-label="Actions" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((c) => (
                            <TableRow
                              key={c.id}
                              onClick={() => setSelected(c.id)}
                            >
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  className="person-cell"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(c.id);
                                  }}
                                >
                                  <Avatar name={c.name} color={c.color} />
                                  <span>
                                    <strong>{c.name}</strong>
                                    <small>{c.role || "Independent"}</small>
                                  </span>
                                </Button>
                              </TableCell>
                              <TableCell>
                                {companyOf(c) ? (
                                  <div className="company-cell">
                                    <span
                                      className={
                                        "company-mark " + companyOf(c).color
                                      }
                                    >
                                      {companyOf(c).name[0]}
                                    </span>
                                    {companyOf(c).name}
                                  </div>
                                ) : (
                                  <span className="muted">Independent</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge status={c.status} />
                              </TableCell>
                              <TableCell className="date-cell">
                                {c.lastContact ? (
                                  <>
                                    <span>{formatDate(c.lastContact)}</span>
                                    {c.lastContact === today && (
                                      <small>Messaged today</small>
                                    )}
                                  </>
                                ) : (
                                  <span className="muted">Not contacted</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  aria-label={"View " + c.name}
                                  className="icon-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(c.id);
                                  }}
                                >
                                  <MoreHorizontal size={18} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="pipeline-board">
                      {statuses
                        .filter(
                          (s) => filter === "All contacts" || filter === s,
                        )
                        .map((s) => (
                          <div className="board-column" key={s}>
                            <div className="board-heading">
                              <Badge status={s} />
                              <span>
                                {filtered.filter((c) => c.status === s).length}
                              </span>
                            </div>
                            {filtered
                              .filter((c) => c.status === s)
                              .map((c) => (
                                <Button
                                  variant="ghost"
                                  key={c.id}
                                  className="board-card"
                                  onClick={() => setSelected(c.id)}
                                >
                                  <Avatar name={c.name} color={c.color} small />
                                  <strong>{c.name}</strong>
                                  <span>
                                    {c.role} ·{" "}
                                    {companyOf(c)?.name || "Independent"}
                                  </span>
                                  {c.followUp && (
                                    <small>
                                      <Clock3 size={12} />
                                      Follow up {formatDate(c.followUp)}
                                    </small>
                                  )}
                                </Button>
                              ))}
                          </div>
                        ))}
                    </div>
                  )}
                  {!filtered.length && (
                    <div className="empty-state">
                      <Users size={30} />
                      <h3>
                        {query || filter !== "All contacts"
                          ? "No matching connections"
                          : "Your network starts here"}
                      </h3>
                      <p>
                        {query
                          ? "Try another name, role, or company."
                          : "Add someone you’d like to work with."}
                      </p>
                      <Button
                        variant="outline"
                        className="button secondary"
                        onClick={addContact}
                      >
                        <Plus size={16} />
                        Add contact
                      </Button>
                    </div>
                  )}
                  <div className="table-footer">
                    <span>
                      {filtered.length} connection
                      {filtered.length !== 1 ? "s" : ""}
                      {filter !== "All contacts" ? " · " + filter : ""}
                    </span>
                    <span>
                      A thoughtful hello goes a long way <Sprout size={13} />
                    </span>
                  </div>
                </Card>
                {page === "Overview" && (
                  <aside className="right-column">
                    <Card className="panel followup-panel">
                      <div className="panel-header">
                        <div className="panel-title">
                          <h2>On your radar</h2>
                          <span className="radar-dot" />
                        </div>
                        <Clock3 size={17} />
                      </div>
                      <p className="panel-description">
                        A little nudge to keep things moving.
                      </p>
                      {followups.length ? (
                        followups.slice(0, 3).map((c) => (
                          <Button
                            variant="ghost"
                            className="followup-item"
                            key={c.id}
                            onClick={() => setSelected(c.id)}
                          >
                            <Avatar name={c.name} color={c.color} small />
                            <span>
                              <strong>{c.name}</strong>
                              <small>
                                {c.followUp < today
                                  ? "Overdue · " + formatDate(c.followUp)
                                  : "Follow up today"}
                              </small>
                            </span>
                            <ChevronRight size={16} />
                          </Button>
                        ))
                      ) : (
                        <div className="small-empty">
                          <CheckCheck size={22} />
                          <p>
                            All caught up. Set a follow-up date on any contact.
                          </p>
                        </div>
                      )}
                      <div className="upcoming-label">NEXT CONVERSATION</div>
                      {meetings.length ? (
                        <Button
                          variant="ghost"
                          className="meeting-card"
                          onClick={() => setSelected(meetings[0].id)}
                        >
                          <div className="meeting-date">
                            <strong>
                              {new Date(
                                meetings[0].meetingDate + "T12:00:00",
                              ).getDate()}
                            </strong>
                            <span>
                              {new Date(
                                meetings[0].meetingDate + "T12:00:00",
                              ).toLocaleDateString("en-US", { month: "short" })}
                            </span>
                          </div>
                          <div>
                            <strong>
                              Meet with {meetings[0].name.split(" ")[0]}
                            </strong>
                            <span>
                              {companyOf(meetings[0])?.name ||
                                "A new opportunity"}{" "}
                              · {meetings[0].opportunity}
                            </span>
                          </div>
                          <ChevronRight size={16} />
                        </Button>
                      ) : (
                        <p className="no-meeting">
                          Your next meeting will appear here.
                        </p>
                      )}
                    </Card>
                    <Card className="profile-card">
                      <div className="profile-card-top">
                        <span className="profile-resource-icon">
                          <BriefcaseBusiness size={20} />
                        </span>
                        <span>MADE FOR YOUR NEXT CHAPTER</span>
                      </div>
                      <h3>
                        Your work.
                        <br />
                        Your best introduction.
                      </h3>
                      <p>
                        Keep your portfolio and CV close. Share what you can
                        bring to the table.
                      </p>
                      <Button
                        variant="ghost"
                        className="button"
                        onClick={() => navigate("My profile")}
                      >
                        My profile & resources <ChevronRight size={16} />
                      </Button>
                      <span className="profile-decoration">✳</span>
                    </Card>
                  </aside>
                )}
              </div>
            </>
          )}
          {page === "Companies" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TEAMS WORTH GETTING TO KNOW</div>
                  <h1>A place for your next chapter.</h1>
                  <p>
                    Keep the companies you’re curious about, all in one place.
                  </p>
                </div>
                <Button
                  className="button primary"
                  onClick={() => setModal({ type: "company" })}
                >
                  <Plus size={17} />
                  Add company
                </Button>
              </div>
              <div className="section-toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <Input
                    aria-label="Search companies"
                    placeholder="Search companies, niches, or countries…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <span className="muted">
                  {data.companies.length} companies in your orbit
                </span>
              </div>
              <div className="company-grid">
                {data.companies
                  .filter((c) =>
                    `${c.name} ${c.niche} ${c.description} ${c.country || ""} ${c.linkedin || ""} ${c.status || "Not checked"}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((c) => (
                    <article className="company-card" key={c.id}>
                      <div className="company-card-top">
                        <span className={"company-logo " + c.color}>
                          {c.name[0]}
                        </span>
                        <Button
                          variant="ghost"
                          aria-label={"Edit " + c.name}
                          className="icon-button"
                          onClick={() =>
                            setModal({ type: "company", company: c })
                          }
                        >
                          <Pencil size={17} />
                        </Button>
                      </div>
                      <h2>{c.name}</h2>
                      <div className="company-tags">
                        <Badge status={c.status || "Not checked"} />
                        <span className="tag">
                          {c.niche || "Niche not set"}
                        </span>
                        {c.country && (
                          <span className="tag">
                            <MapPin size={13} />
                            {c.country}
                          </span>
                        )}
                      </div>
                      <p>
                        {c.description ||
                          "Add a little context about this team."}
                      </p>
                      <div className="company-card-bottom">
                        <Button
                          variant="ghost"
                          className="text-button"
                          onClick={() => {
                            navigate("Contacts");
                            setQuery(c.name);
                          }}
                        >
                          <Users size={15} />
                          {
                            data.contacts.filter((p) => p.companyId === c.id)
                              .length
                          }{" "}
                          {data.contacts.filter((p) => p.companyId === c.id)
                            .length === 1
                            ? "connection"
                            : "connections"}
                        </Button>
                        {safeUrl(c.website) && (
                          <a
                            className="icon-button"
                            aria-label={"Visit " + c.name}
                            href={safeUrl(c.website)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {safeUrl(c.linkedin) && (
                          <a
                            className="icon-button"
                            aria-label={c.name + " on LinkedIn"}
                            title="Company LinkedIn"
                            href={safeUrl(c.linkedin)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Linkedin size={16} />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          className="icon-button danger"
                          aria-label={"Delete " + c.name}
                          onClick={() =>
                            setModal({ type: "deleteCompany", company: c })
                          }
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </article>
                  ))}
              </div>
              {!data.companies.filter((c) =>
                `${c.name} ${c.niche} ${c.description} ${c.country || ""} ${c.linkedin || ""} ${c.status || "Not checked"}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ).length && (
                <div className="empty-state">
                  <Building2 size={32} />
                  <h3>No companies found</h3>
                  <p>Add a team you would love to work with.</p>
                  <Button
                    className="button primary"
                    onClick={() => setModal({ type: "company" })}
                  >
                    Add company
                  </Button>
                </div>
              )}
            </>
          )}
          {page === "Message templates" && (
            <Templates profile={data.profile} toast={toast} />
          )}
          {page === "My profile" && (
            <>
              {legacyData && (
                <div className="legacy-banner">
                  Previous browser records were kept because the server already
                  has data.{" "}
                  <Button
                    variant="ghost"
                    className="text-button"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(legacyData, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "reach-previous-browser-backup.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download previous browser data
                  </Button>
                </div>
              )}
              <Profile
                profile={data.profile}
                onSave={(profile) => {
                  setData((d) => ({ ...d, profile }));
                  toast("Your profile is ready for the next opportunity.");
                }}
                onExport={exportData}
                onImport={() => importRef.current.click()}
                onClear={() => setModal({ type: "clear" })}
              />
            </>
          )}
          <footer className="page-footer">
            <span>
              <Sprout size={14} />A little more intentional. A lot more
              possible.
            </span>
            <span>Your network, your pace.</span>
          </footer>
        </div>
      </main>
      <Input
        type="file"
        accept=".json,application/json"
        ref={importRef}
        className="hidden"
        onChange={importData}
      />
      {contact && !modal && (
        <ContactDetails
          contact={contact}
          company={companyOf(contact)}
          onClose={() => setSelected(null)}
          onEdit={() => setModal({ type: "contact", contact })}
          onDelete={() => setModal({ type: "deleteContact", contact })}
          onUpdate={updateContact}
          toast={toast}
        />
      )}
      {modal?.type === "contact" && (
        <ContactForm
          contact={modal.contact}
          companies={data.companies}
          onClose={() => setModal(null)}
          onSave={(c) => {
            setData((d) => ({
              ...d,
              contacts: modal.contact
                ? d.contacts.map((x) => (x.id === c.id ? c : x))
                : [c, ...d.contacts],
            }));
            setModal(null);
            toast(
              modal.contact
                ? "Contact updated."
                : "A new connection, a new possibility.",
            );
          }}
        />
      )}
      {modal?.type === "company" && (
        <CompanyForm
          company={modal.company}
          onClose={() => setModal(null)}
          onSave={(c) => {
            setData((d) => ({
              ...d,
              companies: modal.company
                ? d.companies.map((x) => (x.id === c.id ? c : x))
                : [...d.companies, c],
            }));
            setModal(null);
            toast("Company saved.");
          }}
        />
      )}
      {["deleteContact", "deleteCompany", "clear", "import"].includes(
        modal?.type,
      ) && (
        <Modal
          title={
            modal.type === "clear"
              ? "Make this space your own"
              : modal.type === "import"
                ? "Restore this backup?"
                : `Delete ${modal.contact?.name || modal.company?.name}?`
          }
          onClose={() => setModal(null)}
        >
          <div className="confirm-body">
            <p>
              {modal.type === "clear"
                ? "This removes all contacts and companies from the server. Your profile will be kept. Export a backup first if you want to keep them."
                : modal.type === "import"
                  ? "This will replace your current contacts, companies, and profile. Export a backup first if you need a copy."
                  : modal.type === "deleteCompany"
                    ? "Contacts will be kept, with the company link removed."
                    : "This contact and their activity history will be removed."}
            </p>
          </div>
          <div className="modal-footer">
            <Button
              variant="outline"
              className="button secondary"
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>
            <Button
              className="button primary"
              onClick={() => {
                if (modal.type === "clear")
                  setData((d) => ({
                    ...d,
                    contacts: [],
                    companies: [],
                    demo: false,
                  }));
                if (modal.type === "import") setData(modal.data);
                if (modal.type === "deleteContact") {
                  setData((d) => ({
                    ...d,
                    contacts: d.contacts.filter(
                      (c) => c.id !== modal.contact.id,
                    ),
                  }));
                  setSelected(null);
                }
                if (modal.type === "deleteCompany")
                  setData((d) => ({
                    ...d,
                    companies: d.companies.filter(
                      (c) => c.id !== modal.company.id,
                    ),
                    contacts: d.contacts.map((c) =>
                      c.companyId === modal.company.id
                        ? { ...c, companyId: "" }
                        : c,
                    ),
                  }));
                setModal(null);
                toast("Workspace updated.");
              }}
            >
              {modal.type === "clear"
                ? "Start fresh"
                : modal.type === "import"
                  ? "Restore backup"
                  : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
      {modal?.type === "help" && (
        <Modal
          title="A little guide to Reach"
          subtitle="A simple routine for meaningful outreach."
          onClose={() => setModal(null)}
        >
          <div className="help-content">
            <p>
              <strong>1. Make it yours.</strong> Add your portfolio and CV links
              in My profile.
            </p>
            <p>
              <strong>2. Find your people.</strong> Save companies, then add
              founders, CTOs, or anyone you’d like to collaborate with.
            </p>
            <p>
              <strong>3. Keep the conversation going.</strong> Open a contact to
              log messages and replies. Set a follow-up date so nobody slips
              through.
            </p>
            <p>
              <strong>4. Take the next step.</strong> Log a meeting and watch
              your pipeline move forward.
            </p>
            <div className="note-box">
              Your data is saved on your CRM server and shared with the
              authenticated API. Use Export backup in your profile to keep a
              copy. Reach helps you track outreach; you send messages through
              your own email or LinkedIn.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
