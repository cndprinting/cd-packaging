"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowLeft, CheckCircle, User, Clock, Package, MessageSquare, Loader2, Pencil, Check, X,
} from "lucide-react";
import { demoJobs } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getStatusColor, getStatusLabel, getPriorityColor, formatDate, formatNumber } from "@/lib/utils";

const STAGES = [
  "QUOTE","ARTWORK_RECEIVED","STRUCTURAL_DESIGN","PROOFING","CUSTOMER_APPROVAL",
  "PREPRESS","PLATING","MATERIALS_ORDERED","MATERIALS_RECEIVED","SCHEDULED",
  "PRINTING","COATING_FINISHING","DIE_CUTTING","GLUING_FOLDING","QA","PACKED","SHIPPED","DELIVERED","INVOICED",
];

interface OrderData {
  orderNumber: string;
  companyName: string;
  status: string;
  priority: string;
  dueDate: string;
  poNumber?: string;
  notes?: string;
}

interface JobItem {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ priority: "", dueDate: "", notes: "", poNumber: "" });
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    async function fetchOrder() {
      // Try API first
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();
        if (res.ok && data.order) {
          const o = data.order;
          setOrder({
            orderNumber: o.orderNumber, companyName: o.companyName || o.company?.name || "",
            status: o.status, priority: o.priority, dueDate: o.dueDate ? (typeof o.dueDate === "string" ? o.dueDate.split("T")[0] : new Date(o.dueDate).toISOString().split("T")[0]) : "",
            poNumber: o.poNumber, notes: o.notes,
          });
          if (data.jobs?.length) {
            setJobs(data.jobs.map((j: Record<string, unknown>) => ({ id: j.id as string, jobNumber: j.jobNumber as string, name: j.name as string, status: j.status as string, priority: j.priority as string, quantity: j.quantity as number, dueDate: j.dueDate ? String(j.dueDate).split("T")[0] : "" })));
          } else if (o.jobs?.length) {
            setJobs(o.jobs.map((j: Record<string, unknown>) => ({ id: j.id as string, jobNumber: j.jobNumber as string, name: j.name as string, status: j.status as string, priority: j.priority as string, quantity: j.quantity as number, dueDate: j.dueDate ? String(j.dueDate).split("T")[0] : "" })));
          }
          setLoading(false);
          return;
        }
      } catch { /* fallback */ }

      // Demo data fallback
      const orderJobs = demoJobs.filter(j => j.orderId === orderId);
      if (orderJobs.length > 0) {
        setOrder({ orderNumber: orderJobs[0].orderNumber, companyName: orderJobs[0].companyName, status: orderJobs[0].status, priority: orderJobs[0].priority, dueDate: orderJobs[0].dueDate });
        setJobs(orderJobs.map(j => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, status: j.status, priority: j.priority, quantity: j.quantity, dueDate: j.dueDate })));
      }
      setLoading(false);
    }
    fetchOrder();
  }, [orderId]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Order not found</h2>
        <Link href="/dashboard/orders"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Orders</Button></Link>
      </div>
    );
  }

  const highestStageIndex = jobs.length > 0 ? Math.max(...jobs.map(j => STAGES.indexOf(j.status))) : STAGES.indexOf(order.status);

  const handleSaveEdit = async () => {
    setSaving(true);
    try { await fetch(`/api/orders/${orderId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) }); } catch {}
    setOrder({ ...order, ...(editForm.priority && { priority: editForm.priority }), ...(editForm.dueDate && { dueDate: editForm.dueDate }), ...(editForm.notes !== undefined && { notes: editForm.notes }), ...(editForm.poNumber !== undefined && { poNumber: editForm.poNumber }) });
    setEditing(false);
    setSaving(false);
    setFeedback("Order updated");
    setTimeout(() => setFeedback(null), 2000);
  };

  return (
    <div className="space-y-6">
      {feedback && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3">{feedback}</div>}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
            <Badge className={getPriorityColor(order.priority)}>{order.priority}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">{order.companyName} &middot; {order.dueDate ? `Due ${formatDate(order.dueDate)}` : ""} &middot; {jobs.length} job{jobs.length !== 1 ? "s" : ""}</p>
          {order.poNumber && <p className="text-xs text-gray-400 mt-0.5">PO: {order.poNumber}</p>}
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => { setEditing(!editing); setEditForm({ priority: order.priority, dueDate: order.dueDate, notes: order.notes || "", poNumber: order.poNumber || "" }); }}>
          {editing ? <><X className="h-4 w-4" />Cancel</> : <><Pencil className="h-4 w-4" />Edit Order</>}
        </Button>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card className="p-4 border-brand-200 bg-brand-50/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label><Select value={editForm.priority} onChange={(e) => setEditForm(p => ({ ...p, priority: e.target.value }))} options={[{ value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label><Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">PO Number</label><Input value={editForm.poNumber} onChange={(e) => setEditForm(p => ({ ...p, poNumber: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><Input value={editForm.notes} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end mt-3"><Button onClick={handleSaveEdit} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save</Button></div>
        </Card>
      )}

      {/* Stage Progress */}
      <Card>
        <CardHeader><CardTitle>Order Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[900px]">
              {STAGES.map((stage, i) => {
                const isCompleted = i < highestStageIndex;
                const isCurrent = i === highestStageIndex;
                return (
                  <div key={stage} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${isCompleted ? "bg-green-600 text-white" : isCurrent ? "bg-green-600 text-white ring-4 ring-green-100" : "bg-gray-200 text-gray-500"}`}>
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <span>{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? "font-semibold text-green-700" : isCompleted ? "text-green-600" : "text-gray-400"}`}>{getStatusLabel(stage)}</span>
                    </div>
                    {i < STAGES.length - 1 && <div className={`h-0.5 w-full ${i < highestStageIndex ? "bg-green-500" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" />Team</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
                <div><p className="text-xs text-gray-500 uppercase">CSR</p><p className="text-sm font-medium">View on individual jobs</p></div>
              <div><p className="text-xs text-gray-500 uppercase">Jobs</p><p className="text-sm font-medium">{jobs.length} job{jobs.length !== 1 ? "s" : ""} in this order</p></div>
              <div><p className="text-xs text-gray-500 uppercase">Status</p><Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Notes</CardTitle></CardHeader>
          <CardContent>
            {order.notes ? (
              <p className="text-sm text-gray-700">{order.notes}</p>
            ) : (
              <div className="space-y-2">
                <Input placeholder="Add a note about this order..." value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={async (e) => {
                  if (e.key === "Enter" && newNote) {
                    await fetch(`/api/orders/${orderId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: newNote }) }).catch(() => {});
                    setOrder({ ...order, notes: newNote });
                    setNewNote("");
                  }
                }} />
                <p className="text-xs text-gray-400">Press Enter to save</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm"><div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0" /><div><p className="text-gray-700">Order created</p><p className="text-xs text-gray-400">Recently</p></div></div>
              <div className="flex items-start gap-2 text-sm"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" /><div><p className="text-gray-700">Jobs assigned</p><p className="text-xs text-gray-400">{jobs.length} jobs in this order</p></div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader><CardTitle>Jobs in this Order</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Job #</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Quantity</TableHead><TableHead>Due Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {jobs.map(j => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono">{j.jobNumber}</TableCell>
                  <TableCell className="font-medium">{j.name}</TableCell>
                  <TableCell><Badge className={getStatusColor(j.status)}>{getStatusLabel(j.status)}</Badge></TableCell>
                  <TableCell><Badge className={getPriorityColor(j.priority)}>{j.priority}</Badge></TableCell>
                  <TableCell>{formatNumber(j.quantity)}</TableCell>
                  <TableCell>{j.dueDate ? formatDate(j.dueDate) : "—"}</TableCell>
                  <TableCell><Link href={`/dashboard/jobs/${j.id}`}><Button variant="ghost" size="sm">View</Button></Link></TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No jobs in this order yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
