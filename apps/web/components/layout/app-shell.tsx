"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { authApi } from "@/lib/api/resources";
import type { User } from "@/lib/api/types";
import { initials } from "@/lib/format";

export function AppShell({ user, children }: { user: User | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.clear();
      router.push("/login");
    },
  });

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="flex w-60 shrink-0 flex-col bg-surface-dark text-on-dark">
        <div className="px-5 py-5">
          <p className="font-display text-lg text-on-dark">DealFlow360</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-surface-dark-elevated text-on-dark" : "text-on-dark-soft hover:bg-surface-dark-elevated hover:text-on-dark"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-3">
          {user ? (
            <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                {initials(user.firstName, user.lastName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-dark">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-on-dark-soft">{user.email}</p>
              </div>
              <button
                onClick={() => logout.mutate()}
                aria-label="Sign out"
                className="rounded-md p-1.5 text-on-dark-soft hover:bg-surface-dark-elevated hover:text-on-dark"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <p className="px-2 py-2 text-xs text-on-dark-soft">Not connected to the API yet.</p>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
