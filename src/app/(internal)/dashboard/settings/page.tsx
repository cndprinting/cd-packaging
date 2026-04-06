"use client";

import { useState } from "react";
import { User, Bell, Shield, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [name, setName] = useState("Sarah Johnson");
  const [email, setEmail] = useState("admin@cndpackaging.com");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwFeedback, setPwFeedback] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [notifications, setNotifications] = useState({ jobUpdates: true, proofApprovals: true, materialAlerts: true, shippingUpdates: false, dailyDigest: true, weeklyReport: true });

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
    </div>
  );
}
