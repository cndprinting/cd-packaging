"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileImage, Send, Eye, Clock, CheckCircle2, Loader2, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface PrepressJob {
  id: string; jobNumber: string; name: string; status: string;
  dueDate: string | null; customer: string; csrName: string;
}

interface QueueProof {
  id: string; jobId: string; version: number;
  fileName: string | null; fileUrl: string | null; notes?: string | null;
  createdAt?: string; sentToCustomerAt?: string | null; deliveryMethod?: string | null;
  customerApprovedAt?: string | null;
  jobNumber: string; jobName: string; customer: string;
  salesRepName: string; salesRepId: string;
}

interface QueueData {
  prepressToDo: PrepressJob[];
  salesToSend: QueueProof[];
  awaitingCustomer: QueueProof[];
  recentlyApproved: QueueProof[];
  currentUser: { id: string; name: string; role: string };
}

export default function ProofingPage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proofs/queue");
      if (res.ok) setData(await res.json());
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markSent = async (proofId: string, deliveryMethod: "email" | "physical") => {
    setPendingAction(proofId);
    try {
      await fetch("/api/proofs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_sent", proofId, deliveryMethod }),
      });
      setFeedback(`Marked as sent via ${deliveryMethod}`);
      await load();
    } catch { setFeedback("Failed to update — please retry"); }
    setPendingAction("");
    setTimeout(() => setFeedback(""), 3000);
  };

  const decide = async (proofId: string, action: "approve" | "reject") => {
    setPendingAction(proofId);
    try {
      await fetch("/api/proofs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, proofId }),
      });
      setFeedback(action === "approve" ? "Approved — production notified" : "Marked as rejected");
      await load();
    } catch { setFeedback("Failed to update — please retry"); }
    setPendingAction("");
    setTimeout(() => setFeedback(""), 3000);
  };

  const userRole = data?.currentUser?.role || "";
  const userId = data?.currentUser?.id || "";
  const isSales = ["SALES", "CSR", "OWNER", "GM", "ADMIN"].includes(userRole);
  const isPrepress = ["PREPRESS", "OWNER", "GM", "ADMIN", "ESTIMATOR"].includes(userRole);

  // Filter proofs to current user if "mine only" is toggled
  const filterMine = (arr: QueueProof[]) => mineOnly ? arr.filter(p => p.salesRepId === userId) : arr;
  const salesToSend = data ? filterMine(data.salesToSend) : [];
  const awaitingCustomer = data ? filterMine(data.awaitingCustomer) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }
  if (!data) {
    return <div className="text-center py-20 text-gray-500">Failed to load proof queue</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileImage className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proofing Queue</h1>
            <p className="text-sm text-gray-500">
              {data.prepressToDo.length} jobs awaiting proof · {data.salesToSend.length} to send ·{" "}
              {data.awaitingCustomer.length} awaiting customer
            </p>
          </div>
        </div>
        {isSales && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 rounded" />
            My jobs only
          </label>
        )}
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3">
          {feedback}
        </div>
      )}

      {/* ─── Pre-press to-do (for PREPRESS role + admins) ─── */}
      {isPrepress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Clock className="h-4 w-4" />
              Pre-press queue — {data.prepressToDo.length} job{data.prepressToDo.length !== 1 ? "s" : ""} awaiting proof upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.prepressToDo.length === 0 ? (
              <p className="text-sm text-gray-400">No jobs currently waiting for proofs. Nice.</p>
            ) : (
              <div className="space-y-2">
                {data.prepressToDo.map((j) => (
                  <div key={j.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-amber-50/40 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/jobs/${j.id}`} className="font-semibold text-sm text-gray-900 hover:text-brand-600">
                          {j.jobNumber}
                        </Link>
                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">{j.status}</Badge>
                        <span className="text-sm text-gray-600">{j.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {j.customer} {j.csrName && `· CSR: ${j.csrName}`}
                        {j.dueDate && <span className="ml-2 text-red-600">Due {formatDate(j.dueDate)}</span>}
                      </div>
                    </div>
                    <Link href={`/dashboard/jobs/${j.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" />Upload proof
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Sales to-send (proofs ready to send to customer) ─── */}
      {isSales && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Send className="h-4 w-4" />
              Ready to send to customer — {salesToSend.length}
              {mineOnly && userId && <span className="text-xs font-normal text-gray-500">(filtered to your jobs)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesToSend.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing to send. 🎉</p>
            ) : (
              <div className="space-y-2">
                {salesToSend.map((p) => (
                  <div key={p.id} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/dashboard/jobs/${p.jobId}`} className="font-semibold text-sm text-gray-900 hover:text-brand-600">
                            {p.jobNumber}
                          </Link>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">v{p.version}</span>
                          {p.fileUrl && (
                            <a href={p.fileUrl} target="_blank" rel="noopener" className="text-xs text-brand-600 hover:underline">
                              {p.fileName || "view proof"}
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{p.jobName} · {p.customer}</div>
                        {p.salesRepName && <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1"><UserIcon className="h-3 w-3" />{p.salesRepName}</div>}
                        {p.notes && <p className="text-xs text-gray-500 mt-1 italic">{p.notes}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={pendingAction === p.id}
                          onClick={() => markSent(p.id, "email")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Email to customer
                        </button>
                        <button
                          disabled={pendingAction === p.id}
                          onClick={() => markSent(p.id, "physical")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                        >
                          Sent physically
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Awaiting customer (sales records the response) ─── */}
      {isSales && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <Clock className="h-4 w-4" />
              Awaiting customer response — {awaitingCustomer.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {awaitingCustomer.length === 0 ? (
              <p className="text-sm text-gray-400">No proofs currently out with customers.</p>
            ) : (
              <div className="space-y-2">
                {awaitingCustomer.map((p) => (
                  <div key={p.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/dashboard/jobs/${p.jobId}`} className="font-semibold text-sm text-gray-900 hover:text-brand-600">
                            {p.jobNumber}
                          </Link>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">v{p.version}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">SENT · {p.deliveryMethod?.toUpperCase()}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{p.jobName} · {p.customer}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Sent {p.sentToCustomerAt ? formatDate(p.sentToCustomerAt) : "—"}
                          {p.salesRepName && ` by ${p.salesRepName}`}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={pendingAction === p.id}
                          onClick={() => decide(p.id, "approve")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-semibold"
                        >
                          ✓ Customer approved
                        </button>
                        <button
                          disabled={pendingAction === p.id}
                          onClick={() => decide(p.id, "reject")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          Rejected
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Recently approved (context for production) ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Recently approved ({data.recentlyApproved.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentlyApproved.length === 0 ? (
            <p className="text-sm text-gray-400">No recent approvals.</p>
          ) : (
            <div className="space-y-1.5">
              {data.recentlyApproved.map((p) => (
                <Link key={p.id} href={`/dashboard/jobs/${p.jobId}`} className="block">
                  <div className="flex items-center justify-between rounded-lg hover:bg-emerald-50/50 px-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{p.jobNumber}</span>
                      <span className="text-sm text-gray-600 truncate">{p.jobName}</span>
                      <span className="text-xs text-gray-400">· {p.customer}</span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      v{p.version} · {p.customerApprovedAt ? formatDate(p.customerApprovedAt) : "—"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
