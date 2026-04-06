"use client";

import React from "react";
import { demoCompanies, demoUsers } from "@/lib/demo-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, User, Mail, Phone, MapPin, Bell, BellOff,
  HelpCircle, MessageSquare, Clock,
} from "lucide-react";

const CUSTOMER_COMPANY_ID = "co-1";

export default function PortalAccountPage() {
  const company = demoCompanies.find((c) => c.id === CUSTOMER_COMPANY_ID);
  const customerUser = demoUsers.find(
    (u) => u.companyId === CUSTOMER_COMPANY_ID && u.role === "CUSTOMER"
  );

  const [notifications, setNotifications] = React.useState({
    orderUpdates: true,
    proofReady: true,
    shipmentTracking: true,
    invoices: false,
    marketing: false,
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Company Name" value={company?.name || "Fresh Foods Co."} />
            <InfoRow label="Industry" value={company?.industry || "Food & Beverage"} />
            <InfoRow label="Account ID" value={company?.id || "co-1"} />
            <InfoRow label="Account Status" value="Active" badge badgeVariant="success" />
            <InfoRow
              label="Address"
              value="1200 Commerce Pkwy, Suite 300, Dallas, TX 75201"
            />
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              icon={User}
              label="Name"
              value={customerUser?.name || "Tom Richards"}
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={customerUser?.email || "tom@freshfoods.com"}
            />
            <InfoRow icon={Phone} label="Phone" value="(214) 555-0198" />
            <InfoRow icon={User} label="Role" value="Purchasing Manager" />
            <div className="pt-3 border-t border-gray-100">
              <Button variant="outline" size="sm">
                Edit Contact Info
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                Contact your C&D rep to update company details.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-400" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { key: "orderUpdates" as const, label: "Order Status Updates", desc: "Get notified when your order moves to a new stage" },
              { key: "proofReady" as const, label: "Proof Ready for Review", desc: "Alerts when a new proof is available for approval" },
              { key: "shipmentTracking" as const, label: "Shipment Tracking", desc: "Delivery updates and tracking notifications" },
              { key: "invoices" as const, label: "Invoice Notifications", desc: "Receive invoice and billing notifications" },
              { key: "marketing" as const, label: "Product Updates", desc: "New capabilities, materials, and services" },
            ].map((pref) => (
              <button
                key={pref.key}
                className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                onClick={() => toggleNotification(pref.key)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pref.desc}</p>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4 ${
                    notifications[pref.key] ? "bg-brand-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      notifications[pref.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </button>
            ))}
            <p className="text-xs text-gray-400 pt-3">
              This is a demo. Notification preferences are not saved.
            </p>
          </CardContent>
        </Card>

        {/* Support Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-gray-400" />
              C&D Packaging Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Need help with an order? Our team is here for you.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <User className="h-5 w-5 text-brand-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Rachel Kim</p>
                  <p className="text-xs text-gray-500">Your Dedicated CSR</p>
                  <p className="text-xs text-brand-600 mt-1">rachel@cndpackaging.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <User className="h-5 w-5 text-brand-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">David Chen</p>
                  <p className="text-xs text-gray-500">Sales Representative</p>
                  <p className="text-xs text-brand-600 mt-1">david@cndpackaging.com</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>(800) 555-PACK (7225)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>support@cndpackaging.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>Mon - Fri, 7:00 AM - 6:00 PM CT</span>
              </div>
            </div>

            <Button variant="outline" className="w-full mt-2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  badge,
  badgeVariant,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  badge?: boolean;
  badgeVariant?: "default" | "success" | "warning" | "destructive";
}) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />}
      <div className="flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        {badge ? (
          <Badge variant={badgeVariant || "default"} className="mt-0.5">
            {value}
          </Badge>
        ) : (
          <p className="text-sm font-medium text-gray-900">{value}</p>
        )}
      </div>
    </div>
  );
}
