"use client";

import { useState, useEffect, useMemo } from "react";
import { HelpCircle, Plus, X, Loader2, Check, AlertTriangle, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  page: string | null;
  submittedByName: string;
  submittedByRole: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const categoryColors: Record<string, string> = {
  bug: "bg-red-100 text-red-700",
  feature: "bg-blue-100 text-blue-700",
  question: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-400",
};

export default function HelpDeskPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userRole, setUserRole] = useState("");
  const [form, setForm] = useState({ title: "", description: "", category: "bug", priority: "normal", page: "" });

  useEffect(() => {
    fetch("/api/help-desk").then(r => r.json()).then(d => setTickets(d.tickets || [])).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/auth/session").then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role); }).catch(() => {});
  }, []);

  const isAdmin = ["OWNER", "GM", "ADMIN"].includes(userRole);

  const filtered = useMemo(() => {
    if (!statusFilter) return tickets;
    return tickets.filter(t => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title || !form.description) { setError("Title and description required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/help-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        setTickets(prev => [data.ticket, ...prev]);
        setShowModal(false);
        setForm({ title: "", description: "", category: "bug", priority: "normal", page: "" });
      } else setError(data.error || "Failed");
    } catch { setError("Something went wrong"); }
    setCreating(false);
  };

  const updateTicketStatus = async (id: string, status: string, resolution?: string) => {
    try {
      const res = await fetch("/api/help-desk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, resolution }),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(prev => prev.map(t => t.id === id ? { ...t, ...data.ticket } : t));
      }
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Help Desk</h1>
            <p className="text-sm text-gray-500">Report issues, request features, ask questions</p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2"><Plus className="h-4 w-4" />New Ticket</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{openCount}</p>
          <p className="text-xs text-gray-500">Open</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
          <p className="text-xs text-gray-500">In Progress</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{resolvedCount}</p>
          <p className="text-xs text-gray-500">Resolved</p>
        </Card>
      </div>

      <Card className="p-4">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
          { value: "", label: "All Tickets" },
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In Progress" },
          { value: "resolved", label: "Resolved" },
          { value: "closed", label: "Closed" },
        ]} className="w-40" />
      </Card>

      <div className="space-y-4">
        {filtered.map((ticket) => (
          <Card key={ticket.id} className={`border-l-4 ${ticket.status === "open" ? "border-l-amber-400" : ticket.status === "in_progress" ? "border-l-blue-400" : ticket.status === "resolved" ? "border-l-emerald-400" : "border-l-gray-300"}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{ticket.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={categoryColors[ticket.category]}>{ticket.category}</Badge>
                    <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                    <Badge className={statusColors[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                    {ticket.page && <span className="text-xs text-gray-400">on {ticket.page}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>{ticket.submittedByName}</p>
                  <p>{formatDate(ticket.createdAt)}</p>
                </div>
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{ticket.description}</p>

              {ticket.resolution && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-emerald-800">Resolution by {ticket.resolvedBy}:</p>
                  <p className="text-sm text-emerald-700 mt-1">{ticket.resolution}</p>
                </div>
              )}

              {isAdmin && ticket.status !== "closed" && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {ticket.status === "open" && (
                    <Button size="sm" variant="outline" className="gap-1 text-blue-600" onClick={() => updateTicketStatus(ticket.id, "in_progress")}>
                      <Clock className="h-3.5 w-3.5" /> Start Working
                    </Button>
                  )}
                  {(ticket.status === "open" || ticket.status === "in_progress") && (
                    <Button size="sm" variant="outline" className="gap-1 text-emerald-600" onClick={() => {
                      const res = prompt("Resolution notes (what was fixed/answered):");
                      if (res) updateTicketStatus(ticket.id, "resolved", res);
                    }}>
                      <Check className="h-3.5 w-3.5" /> Resolve
                    </Button>
                  )}
                  {ticket.status === "resolved" && (
                    <Button size="sm" variant="outline" className="gap-1 text-gray-500" onClick={() => updateTicketStatus(ticket.id, "closed")}>
                      Close
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card className="p-12 text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{statusFilter ? `No ${statusFilter} tickets` : "No tickets yet"}</p>
            <p className="text-xs text-gray-400 mt-1">Click "New Ticket" to report an issue or request a feature</p>
          </Card>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">New Help Ticket</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of the issue" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Explain the issue in detail. What were you trying to do? What happened instead?"
                    rows={4}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <Select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} options={[
                      { value: "bug", label: "Bug" },
                      { value: "feature", label: "Feature Request" },
                      { value: "question", label: "Question" },
                      { value: "other", label: "Other" },
                    ]} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <Select value={form.priority} onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))} options={[
                      { value: "low", label: "Low" },
                      { value: "normal", label: "Normal" },
                      { value: "high", label: "High" },
                      { value: "urgent", label: "Urgent" },
                    ]} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
                    <Input value={form.page} onChange={(e) => setForm(p => ({ ...p, page: e.target.value }))} placeholder="e.g. Quotes" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Ticket"}</Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
