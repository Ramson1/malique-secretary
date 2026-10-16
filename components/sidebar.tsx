"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  Warehouse,
  BarChart3,
  X,
  ChevronLeft,
  ChevronRight,
  UserRound,
  ShoppingCart,
  Send,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
  badgeKey?: "messages";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Counter",
    items: [
      { href: "/dashboard", label: "New Sale", icon: LayoutDashboard },
      { href: "/dashboard/sales", label: "My Transactions", icon: ReceiptText },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
      { href: "/dashboard/dispatch", label: "Dispatch", icon: Send },
    ],
  },
  {
    title: "Stock",
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Warehouse },
      { href: "/dashboard/report", label: "Shift Report", icon: BarChart3 },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/dashboard/profile", label: "Profile", icon: UserRound }],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  unreadMessages?: number;
}

export function Sidebar({
  isOpen,
  onClose,
  collapsed = false,
  onToggleCollapse,
  unreadMessages = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const role = user?.role ?? "";

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    // Avoid /dashboard matching every /dashboard/* child.
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const rail = collapsed;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full gradient-navy flex flex-col transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          rail ? "w-20" : "w-72"
        } ${isOpen ? "translate-x-0 w-72" : "-translate-x-full"}`}
      >
        {/* Logo + collapse toggle (toggle sits top-right on desktop) */}
        <div
          className={`flex items-center h-20 border-b border-white/10 ${
            rail ? "justify-center gap-1 px-2" : "justify-between px-5"
          }`}
        >
          <Link href="/dashboard" className="flex items-center gap-3 group min-w-0">
            <img
              src="/logo.png"
              alt="Malique Oil and Gas logo"
              className="w-11 h-11 rounded-full shadow-lg ring-2 ring-amber-500/30 group-hover:ring-amber-500/60 transition-all"
            />
            {!rail && (
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold text-white leading-tight truncate">
                  Malique
                </span>
                <span className="text-[10px] font-semibold text-amber-400/90 uppercase tracking-[0.18em] leading-none">
                  Staff Portal
                </span>
              </div>
            )}
          </Link>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex shrink-0 p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
              title={rail ? "Expand sidebar" : "Collapse sidebar"}
            >
              {rail ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 scrollbar-thin">
          {sections.map((section) => {
            const visible = section.items.filter(
              (item) => !item.roles || item.roles.includes(role),
            );
            if (!visible.length) return null;
            return (
              <div key={section.title} className="mb-5">
                {!rail && (
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {section.title}
                  </p>
                )}
                {rail && <div className="mx-2 mb-2 h-px bg-white/5" />}
                <ul className="space-y-1">
                  {visible.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    const showBadge =
                      item.badgeKey === "messages" && unreadMessages > 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          title={rail ? item.label : undefined}
                          className={`group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                            rail ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
                          } ${
                            active
                              ? "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/25"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 shrink-0 ${
                              active ? "text-amber-400" : ""
                            }`}
                          />
                          {!rail && <span className="truncate">{item.label}</span>}
                          {showBadge &&
                            (rail ? (
                              <span className="absolute top-1.5 right-2 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {unreadMessages > 9 ? "9+" : unreadMessages}
                              </span>
                            ) : (
                              <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadMessages > 99 ? "99+" : unreadMessages}
                              </span>
                            ))}
                          {rail && (
                            <span className="pointer-events-none absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded-lg bg-navy-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 z-50">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* User info */}
        <div className={`border-t border-white/10 ${rail ? "p-3" : "p-4"}`}>
          <Link
            href="/dashboard/profile"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-xl transition-colors hover:bg-white/5 ${
              rail ? "justify-center" : ""
            }`}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-500/30"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-amber-400">
                  {(user?.firstName?.[0] || "A") + (user?.lastName?.[0] || "")}
                </span>
              </div>
            )}
            {!rail && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user ? `${user.firstName} ${user.lastName}` : "Staff"}
                </p>
                <p className="text-xs text-slate-400 truncate capitalize">
                  {role ? role.replace("_", " ") : "staff"}
                </p>
              </div>
            )}
          </Link>
        </div>

        {/* Developer credit — made prominent per brand rules */}
        {!rail && (
          <div className="px-4 pb-4 pt-1">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
              <p className="text-xs font-medium text-slate-400 mb-1.5">
                Designed &amp; Developed by
              </p>
              <a
                href="https://blackboxtech.online"
                target="_blank"
                rel="noopener noreferrer"
                title="Black-Box Tech — info@blackboxtech.online"
                className="inline-flex items-center justify-center gap-2 font-bold text-sm text-slate-200 hover:text-amber-400 transition-colors"
              >
                <img
                  src="/blackbox-tech.jpg"
                  alt="Black-Box Tech logo"
                  className="w-6 h-6 rounded-md ring-1 ring-white/10"
                />
                Black-Box Tech
              </a>
              <a
                href="mailto:info@blackboxtech.online"
                className="mt-1 block text-[11px] text-slate-500 hover:text-amber-400 transition-colors"
              >
                info@blackboxtech.online
              </a>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
