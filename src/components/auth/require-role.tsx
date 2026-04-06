"use client";

import React, { useEffect, useState } from "react";
import { Shield } from "lucide-react";

interface RequireRoleProps {
  allowed: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ allowed, children, fallback }: RequireRoleProps) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => { setRole(d.user?.role || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (!role || !allowed.includes(role)) {
    return fallback || (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Shield className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium text-gray-600">Access Restricted</p>
        <p className="text-sm mt-1">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
