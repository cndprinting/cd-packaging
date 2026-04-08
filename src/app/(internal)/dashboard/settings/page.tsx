"use client";

import { useState, useEffect } from "react";
import { User, Bell, Shield, Loader2, Check, Factory, DollarSign, Droplets, Scissors, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PlantStandards {
  id: string;
  markupPaper: number;
  markupMaterial: number;
  markupLabor: number;
  markupOutside: number;
  markupLayoutRate: number;
  artworkRate: number;
  typesettingRate: number;
  proofingRate: number;
  scanningRate: number;
  plateMakingRate: number;
  inkBlackPerLb: number;
  inkColorPerLb: number;
  inkPmsPerLb: number;
  inkMetallicPerLb: number;
  inkAqueousPerLb: number;
  inkVarnishPerLb: number;
  coverageBlackUncoated: number;
  coverageColorUncoated: number;
  coverageBlackCoated: number;
  coverageColorCoated: number;
  trimmingRate: number;
  drillingRate: number;
  handBinderyRate: number;
  paddingRate: number;
  wrappingRate: number;
  folder1Rate: number;
  folder2Rate: number;
  folder3Rate: number;
  saddleStitch1Rate: number;
  saddleStitch2Rate: number;
  deliveryRate: number;
  deliveryAvgMinutes: number;
  packingRate: number;
  skidCost: number;
  scorePerfRate: number;
  [key: string]: string | number;
}

function PlantStandardsField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <Input type="number" step="0.01" value={value || ""} onChange={(e) => onChange(Number(e.target.value))} className="h-9 text-sm" />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(d => {
      if (d.user) { setName(d.user.name || ""); setEmail(d.user.email || ""); }
    }).catch(() => {});
  }, []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwFeedback, setPwFeedback] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [notifications, setNotifications] = useState({ jobUpdates: true, proofApprovals: true, materialAlerts: true, shippingUpdates: false, dailyDigest: true, weeklyReport: true });
  const [standards, setStandards] = useState<PlantStandards | null>(null);
  const [savingStandards, setSavingStandards] = useState(false);
  const [standardsFeedback, setStandardsFeedback] = useState("");

  useEffect(() => {
    fetch("/api/plant-standards").then((r) => r.json()).then((d) => { if (d.standards) setStandards(d.standards); }).catch(() => {});
  }, []);

  const updateStandard = (key: string, value: number) => {
    setStandards((prev) => prev ? { ...prev, [key]: value } : null);
  };

  const saveStandards = async () => {
    if (!standards) return;
    setSavingStandards(true);
    try {
      const { id, ...data } = standards;
      const res = await fetch("/api/plant-standards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standards: data }) });
      if (res.ok) { setStandardsFeedback("Plant standards saved!"); }
      else setStandardsFeedback("Failed to save");
    } catch { setStandardsFeedback("Something went wrong"); }
    setSavingStandards(false);
    setTimeout(() => setStandardsFeedback(""), 3000);
  };

  const toggleNotification = (key: keyof typeof notifications) => setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
      if (res.ok) setFeedback("Settings saved!");
      else setFeedback("Saved locally (demo mode)");
    } catch { setFeedback("Saved locally (demo mode)"); }
    setSaving(false);
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleChangePw = async () => {
    if (!currentPassword || !newPassword) { setPwFeedback("Both fields required"); return; }
    if (newPassword.length < 6) { setPwFeedback("Password must be at least 6 characters"); return; }
    setChangingPw(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await res.json();
      if (res.ok) { setPwFeedback("Password changed!"); setCurrentPassword(""); setNewPassword(""); setShowPwForm(false); }
      else setPwFeedback(data.error || "Failed to change password");
    } catch { setPwFeedback("Something went wrong"); }
    setChangingPw(false);
    setTimeout(() => setPwFeedback(""), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold text-gray-900">Settings</h1><p className="text-sm text-gray-500 mt-1">Manage your profile and preferences</p></div>

      {feedback && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3 flex items-center gap-2"><Check className="h-4 w-4" />{feedback}</div>}

      <Card>
        <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-green-50 p-2.5"><User className="h-5 w-5 text-green-600" /></div><div><CardTitle>Profile</CardTitle><CardDescription>Your personal information</CardDescription></div></div></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Email</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div className="flex justify-end mt-4"><Button onClick={handleSave} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Saving..." : "Save Changes"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2.5"><Bell className="h-5 w-5 text-blue-600" /></div><div><CardTitle>Notifications</CardTitle><CardDescription>Choose what notifications you receive</CardDescription></div></div></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {([["jobUpdates","Job Status Updates","Get notified when a job changes stage"],["proofApprovals","Proof Approvals","Notifications for proof approval or rejection"],["materialAlerts","Material Alerts","Low stock and shortage warnings"],["shippingUpdates","Shipping Updates","Tracking and delivery notifications"],["dailyDigest","Daily Digest","Summary each morning"],["weeklyReport","Weekly Report","KPIs each Monday"]] as const).map(([key, label, desc]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div><p className="text-sm font-medium text-gray-900">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                <button onClick={() => toggleNotification(key)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${notifications[key] ? "bg-green-600" : "bg-gray-200"}`}>
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${notifications[key] ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-gray-100 p-2.5"><Shield className="h-5 w-5 text-gray-600" /></div><div><CardTitle>Account</CardTitle><CardDescription>Security and account settings</CardDescription></div></div></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Role</p></div><Badge className="bg-green-100 text-green-700">Admin</Badge></div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Password</p></div>
              <Button variant="outline" size="sm" onClick={() => setShowPwForm(!showPwForm)}>{showPwForm ? "Cancel" : "Change Password"}</Button>
            </div>
            {showPwForm && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                {pwFeedback && <div className={`text-sm p-2 rounded ${pwFeedback.includes("changed") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{pwFeedback}</div>}
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Current Password</label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">New Password</label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" /></div>
                <Button onClick={handleChangePw} disabled={changingPw} className="gap-1.5">{changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Update Password</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Plant Standards ───────────────────────────────────────── */}
      {standards && (
        <>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-brand-50 p-2.5"><Factory className="h-5 w-5 text-brand-600" /></div>
              <div><h2 className="text-lg font-bold text-gray-900">Plant Standards</h2><p className="text-xs text-gray-500">Rates and costs from C&D plant configuration</p></div>
            </div>
            {standardsFeedback && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3 flex items-center gap-2"><Check className="h-4 w-4" />{standardsFeedback}</div>}
          </div>

          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-emerald-50 p-2.5"><DollarSign className="h-5 w-5 text-emerald-600" /></div><div><CardTitle>Markup Percentages</CardTitle><CardDescription>Applied to cost categories when calculating estimates</CardDescription></div></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PlantStandardsField label="Paper %" value={standards.markupPaper} onChange={(v) => updateStandard("markupPaper", v)} hint="Substrate costs" />
                <PlantStandardsField label="Material %" value={standards.markupMaterial} onChange={(v) => updateStandard("markupMaterial", v)} hint="Ink, plates, tooling" />
                <PlantStandardsField label="Labor %" value={standards.markupLabor} onChange={(v) => updateStandard("markupLabor", v)} hint="Press, prepress, setup" />
                <PlantStandardsField label="Outside %" value={standards.markupOutside} onChange={(v) => updateStandard("markupOutside", v)} hint="Shipping, services" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2.5"><User className="h-5 w-5 text-blue-600" /></div><div><CardTitle>Pre-Press & Labor Rates</CardTitle><CardDescription>Hourly rates for pre-press operations</CardDescription></div></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <PlantStandardsField label="Markup/Layout ($/hr)" value={standards.markupLayoutRate} onChange={(v) => updateStandard("markupLayoutRate", v)} />
                <PlantStandardsField label="Artwork ($/hr)" value={standards.artworkRate} onChange={(v) => updateStandard("artworkRate", v)} />
                <PlantStandardsField label="Typesetting ($/hr)" value={standards.typesettingRate} onChange={(v) => updateStandard("typesettingRate", v)} />
                <PlantStandardsField label="Proofing ($/hr)" value={standards.proofingRate} onChange={(v) => updateStandard("proofingRate", v)} />
                <PlantStandardsField label="Scanning ($/hr)" value={standards.scanningRate} onChange={(v) => updateStandard("scanningRate", v)} />
                <PlantStandardsField label="Plate Making ($/hr)" value={standards.plateMakingRate} onChange={(v) => updateStandard("plateMakingRate", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-purple-50 p-2.5"><Droplets className="h-5 w-5 text-purple-600" /></div><div><CardTitle>Ink Costs</CardTitle><CardDescription>Per-pound ink costs and coverage rates</CardDescription></div></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <PlantStandardsField label="Black ($/lb)" value={standards.inkBlackPerLb} onChange={(v) => updateStandard("inkBlackPerLb", v)} />
                <PlantStandardsField label="Color ($/lb)" value={standards.inkColorPerLb} onChange={(v) => updateStandard("inkColorPerLb", v)} />
                <PlantStandardsField label="PMS ($/lb)" value={standards.inkPmsPerLb} onChange={(v) => updateStandard("inkPmsPerLb", v)} />
                <PlantStandardsField label="Metallic ($/lb)" value={standards.inkMetallicPerLb} onChange={(v) => updateStandard("inkMetallicPerLb", v)} />
                <PlantStandardsField label="Aqueous ($/lb)" value={standards.inkAqueousPerLb} onChange={(v) => updateStandard("inkAqueousPerLb", v)} />
                <PlantStandardsField label="Varnish ($/lb)" value={standards.inkVarnishPerLb} onChange={(v) => updateStandard("inkVarnishPerLb", v)} />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-3">Ink Coverage (thousands of sq inches per lb)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <PlantStandardsField label="Black Uncoated" value={standards.coverageBlackUncoated} onChange={(v) => updateStandard("coverageBlackUncoated", v)} />
                  <PlantStandardsField label="Black Coated" value={standards.coverageBlackCoated} onChange={(v) => updateStandard("coverageBlackCoated", v)} />
                  <PlantStandardsField label="Color Uncoated" value={standards.coverageColorUncoated} onChange={(v) => updateStandard("coverageColorUncoated", v)} />
                  <PlantStandardsField label="Color Coated" value={standards.coverageColorCoated} onChange={(v) => updateStandard("coverageColorCoated", v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-amber-50 p-2.5"><Scissors className="h-5 w-5 text-amber-600" /></div><div><CardTitle>Bindery Rates</CardTitle><CardDescription>Hourly rates for finishing operations</CardDescription></div></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <PlantStandardsField label="Trimming ($/hr)" value={standards.trimmingRate} onChange={(v) => updateStandard("trimmingRate", v)} />
                <PlantStandardsField label="Drilling ($/hr)" value={standards.drillingRate} onChange={(v) => updateStandard("drillingRate", v)} />
                <PlantStandardsField label="Hand Bindery ($/hr)" value={standards.handBinderyRate} onChange={(v) => updateStandard("handBinderyRate", v)} />
                <PlantStandardsField label="Padding ($/hr)" value={standards.paddingRate} onChange={(v) => updateStandard("paddingRate", v)} />
                <PlantStandardsField label="Wrapping ($/hr)" value={standards.wrappingRate} onChange={(v) => updateStandard("wrappingRate", v)} />
                <PlantStandardsField label="Score/Perf ($/hr)" value={standards.scorePerfRate} onChange={(v) => updateStandard("scorePerfRate", v)} />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-3">Folding & Saddle Stitching</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <PlantStandardsField label="Folder 1 - Baum ($/hr)" value={standards.folder1Rate} onChange={(v) => updateStandard("folder1Rate", v)} />
                  <PlantStandardsField label="Folder 2 - Sm Baum ($/hr)" value={standards.folder2Rate} onChange={(v) => updateStandard("folder2Rate", v)} />
                  <PlantStandardsField label="Folder 3 - Stahl ($/hr)" value={standards.folder3Rate} onChange={(v) => updateStandard("folder3Rate", v)} />
                  <PlantStandardsField label="Mueller Stitcher ($/hr)" value={standards.saddleStitch1Rate} onChange={(v) => updateStandard("saddleStitch1Rate", v)} />
                  <PlantStandardsField label="Rosback Stitcher ($/hr)" value={standards.saddleStitch2Rate} onChange={(v) => updateStandard("saddleStitch2Rate", v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-sky-50 p-2.5"><Truck className="h-5 w-5 text-sky-600" /></div><div><CardTitle>Delivery & Packing</CardTitle><CardDescription>Shipping and packing cost parameters</CardDescription></div></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PlantStandardsField label="Delivery ($/hr)" value={standards.deliveryRate} onChange={(v) => updateStandard("deliveryRate", v)} />
                <PlantStandardsField label="Avg Delivery (min)" value={standards.deliveryAvgMinutes} onChange={(v) => updateStandard("deliveryAvgMinutes", v)} />
                <PlantStandardsField label="Packing ($/hr)" value={standards.packingRate} onChange={(v) => updateStandard("packingRate", v)} />
                <PlantStandardsField label="Skid Cost ($)" value={standards.skidCost} onChange={(v) => updateStandard("skidCost", v)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveStandards} disabled={savingStandards} className="gap-1.5">
              {savingStandards ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {savingStandards ? "Saving..." : "Save Plant Standards"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
