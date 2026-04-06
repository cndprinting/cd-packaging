"use client";

import React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  isCustomer?: boolean;
}

export function AppShell({ children, isCustomer = false }: AppShellProps) {
  const [user, setUser] = React.useState<{ name: string; email: string; companyName: string | null } | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => { if (d.user) setUser(d.user); }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isCustomer={isCustomer} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar userName={user?.name} userEmail={user?.email} companyName={user?.companyName || "C&D Packaging"} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
