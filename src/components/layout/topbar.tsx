"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Bell, Settings, LogOut, User, ChevronDown, Package, ClipboardList, Building2, Loader2 } from "lucide-react";
import { getStatusColor, getStatusLabel } from "@/lib/utils";

interface SearchResult {
  type: "job" | "order" | "company";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status: string | null;
}

interface TopbarProps {
  userName?: string;
  userEmail?: string;
  companyName?: string;
}

export function Topbar({ userName = "User", userEmail, companyName = "C&D Packaging" }: TopbarProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<NodeJS.Timeout>(undefined);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  };

  const closeSearch = () => {
    setTimeout(() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }, 200);
  };

  const typeIcon = (type: string) => {
    if (type === "job") return <Package className="h-4 w-4 text-blue-500" />;
    if (type === "order") return <ClipboardList className="h-4 w-4 text-green-500" />;
    return <Building2 className="h-4 w-4 text-gray-500" />;
  };

  return (
    <header className="flex items-center justify-between h-14 px-4 lg:px-6 bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-4">
        <div ref={searchRef} className={cn("relative", searchOpen ? "w-80" : "w-auto")}>
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
              <input
                type="text"
                placeholder="Search jobs, orders, customers..."
                className="w-full h-9 pl-9 pr-9 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onBlur={closeSearch}
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                  {searchResults.map((r) => (
                    <a
                      key={`${r.type}-${r.id}`}
                      href={r.href}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {typeIcon(r.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                        <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                      </div>
                      {r.status && <Badge className={cn("text-[10px] shrink-0", getStatusColor(r.status))}>{getStatusLabel(r.status)}</Badge>}
                      <span className="text-[10px] text-gray-400 uppercase shrink-0">{r.type}</span>
                    </a>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 text-center text-sm text-gray-400">
                  No results for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700">{companyName}</span>
      </div>

      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="C&D Printing and Packaging" className="hidden md:block h-9" />
        <img src="/logo-icon.svg" alt="C&D" className="block md:hidden h-8 w-8" />
        <div className="h-6 w-px bg-gray-200 hidden md:block" />
        <a href="/dashboard/settings" className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Settings className="h-5 w-5" />
        </a>
        <button className="relative flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-50 transition-colors">
            <Avatar fallback={userName} size="sm" />
            <span className="hidden lg:block text-sm font-medium text-gray-700">{userName.split(" ")[0]}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-50 py-1">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500">{userEmail || ""}</p>
                </div>
                <a href="/dashboard/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <User className="h-4 w-4 text-gray-400" /> Profile
                </a>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={async () => {
                      await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
                      window.location.href = "/login";
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
