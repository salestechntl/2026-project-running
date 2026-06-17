import { type ComponentType, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, Footprints } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon?: ComponentType<{ className?: string }>;
  /** จำนวนรายการใหม่ — แสดงเป็นวงกลมสีส้ม */
  badge?: number;
}

/** วงกลมสีส้มแจ้งจำนวนรายการใหม่ */
function NotifDot({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm ring-2 ring-background",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <Footprints className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-extrabold tracking-tight text-foreground">
          Running Camp
        </span>
        <span className="block text-[11px] font-semibold tracking-wide text-primary">2026</span>
      </span>
    </Link>
  );
}

export function AppShell({ children, nav }: { children: ReactNode; nav?: NavItem[] }) {
  const { user, isLead, logout } = useAuth();
  const navigate = useNavigate();
  const hasNav = !!nav && nav.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Brand />

          {/* Desktop nav */}
          {hasNav && (
            <nav className="hidden items-center gap-1 md:flex">
              {nav!.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/app"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )
                  }
                >
                  {n.label}
                  {!!n.badge && <NotifDot count={n.badge} />}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="flex items-center justify-end gap-1.5 text-sm font-semibold leading-tight text-foreground">
                  {isLead && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                      หัวหน้าทีม
                    </span>
                  )}
                  {user.name}
                </p>
                <p className="tnum mt-0.5 text-xs leading-tight text-muted-foreground">รหัส {user.id}</p>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* extra bottom padding on mobile so content clears the tab bar */}
      <main className={cn("container flex-1 py-8 md:py-10", hasNav && "pb-24 md:pb-10")}>{children}</main>

      <footer className="hidden border-t border-border/70 py-6 md:block">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>Running Camp 2026 — โครงการส่งเสริมสุขภาพพนักงาน</p>
          <p>ข้อมูลถูกบันทึกอย่างปลอดภัย</p>
        </div>
      </footer>

      {/* Mobile bottom tab bar */}
      {hasNav && (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(17,17,26,0.06)] backdrop-blur-md md:hidden"
          aria-label="เมนูหลัก"
        >
          <div className="mx-auto flex max-w-md items-stretch">
            {nav!.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/app"}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "absolute top-0 h-0.5 w-8 rounded-full transition-colors",
                        isActive ? "bg-primary" : "bg-transparent",
                      )}
                    />
                    <span className="relative">
                      {n.icon && <n.icon className="h-[22px] w-[22px]" />}
                      {!!n.badge && <NotifDot count={n.badge} className="absolute -right-2.5 -top-1.5" />}
                    </span>
                    <span className="leading-none">{n.short ?? n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
