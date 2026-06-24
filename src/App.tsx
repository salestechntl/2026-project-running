import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Home as HomeIcon, PenLine, BarChart3, Users, Building2, Download, UserCog } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { countPendingForTeam, DATA_CHANGED_EVENT } from "@/lib/entries";
import { useSubordinates } from "@/lib/hooks/useTeam";
import { useRejectedEntryCount } from "@/lib/hooks/useEntries";
import { AppShell, type NavItem } from "@/components/AppShell";
import Login from "@/pages/Login";
import SetPassword from "@/pages/SetPassword";
import Home from "@/pages/Home";
import LogEntry from "@/pages/LogEntry";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import SuperAdmin from "@/pages/SuperAdmin";
import Export from "@/pages/Export";
import EmployeeAdmin from "@/pages/EmployeeAdmin";

function canManageTeam(isLead: boolean, isChecker: boolean, isSuperAdmin: boolean): boolean {
  return isLead || isChecker || isSuperAdmin;
}

/** จำนวนรายการรออนุมัติของทีม สำหรับ badge บนเมนู "ข้อมูลทีม" */
function usePendingTeamCount(userId: string | undefined, canManage: boolean): number {
  const { team } = useSubordinates(canManage ? userId : undefined);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || !canManage || team.length === 0) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const ids = team.map((e) => e.id);
    const recompute = async () => {
      try {
        const n = await countPendingForTeam(userId, ids);
        if (!cancelled) setCount(n);
      } catch (e) {
        console.error("usePendingTeamCount:", e);
      }
    };
    void recompute();
    const onChange = () => void recompute();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(DATA_CHANGED_EVENT, onChange);
    };
  }, [userId, canManage, team]);

  return count;
}

function ProtectedLayout() {
  const { user, isLead, isChecker, isSuperAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const manageTeam = canManageTeam(isLead, isChecker, isSuperAdmin);
  const teamPending = usePendingTeamCount(user.id, manageTeam);
  const rejectedCount = useRejectedEntryCount(user.id);

  const nav: NavItem[] = [
    { to: "/app", label: "หน้าแรก", short: "หน้าแรก", icon: HomeIcon },
    {
      to: "/app/log",
      label: "บันทึกข้อมูล",
      short: "บันทึก",
      icon: PenLine,
      badge: rejectedCount || undefined,
    },
    { to: "/app/dashboard", label: "Dashboard", short: "Dashboard", icon: BarChart3 },
    ...(manageTeam
      ? [{ to: "/app/admin", label: "ข้อมูลทีม", short: "ทีม", icon: Users, badge: teamPending }]
      : []),
    ...(isSuperAdmin
      ? [
          { to: "/app/employees", label: "จัดการพนักงาน", short: "พนักงาน", icon: UserCog },
          { to: "/app/super-admin", label: "โครงสร้างองค์กร", short: "Org", icon: Building2 },
          { to: "/app/export", label: "Export", short: "Export", icon: Download },
        ]
      : []),
  ];

  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  );
}

function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function TeamManagerOnly({ children }: { children: React.ReactNode }) {
  const { isLead, isChecker, isSuperAdmin } = useAuth();
  if (!canManageTeam(isLead, isChecker, isSuperAdmin)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/app" element={<ProtectedLayout />}>
          <Route index element={<Home />} />
          <Route path="log" element={<LogEntry />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="admin"
            element={
              <TeamManagerOnly>
                <Admin />
              </TeamManagerOnly>
            }
          />
          <Route
            path="employees"
            element={
              <SuperAdminOnly>
                <EmployeeAdmin />
              </SuperAdminOnly>
            }
          />
          <Route
            path="super-admin"
            element={
              <SuperAdminOnly>
                <SuperAdmin />
              </SuperAdminOnly>
            }
          />
          <Route
            path="export"
            element={
              <SuperAdminOnly>
                <Export />
              </SuperAdminOnly>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
