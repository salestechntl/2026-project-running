import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { downloadExportCsv } from "@/lib/api";
import { Button, Card } from "@/components/ui";

type ExportKind = "runs" | "weights";

export default function Export() {
  const { authMode } = useAuth();
  const [loading, setLoading] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string>();
  const [lastFile, setLastFile] = useState<string>();

  async function handleExport(kind: ExportKind) {
    if (authMode !== "api") {
      setError("ต้องใช้โหมด Supabase + API — ตั้งค่า VITE_SUPABASE_URL แล้ว login ด้วย Super Admin");
      return;
    }
    setLoading(kind);
    setError(undefined);
    try {
      const filename = await downloadExportCsv(kind);
      setLastFile(filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export ไม่สำเร็จ");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Export ข้อมูล</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ดาวน์โหลด CSV จากตาราง <code className="text-xs">run_entries</code> และ{" "}
          <code className="text-xs">weight_entries</code> ทั้งองค์กร — สำหรับ Super Admin / Bot
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {lastFile && !loading && (
        <p role="status" className="text-sm text-success">
          ดาวน์โหลดแล้ว: {lastFile}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">run_entries</h2>
              <p className="text-xs text-muted-foreground">บันทึกการวิ่งทั้งหมด</p>
            </div>
          </div>
          <Button
            id="export-runs-btn"
            data-testid="export-runs-btn"
            size="lg"
            className="w-full"
            disabled={loading !== null}
            onClick={() => void handleExport("runs")}
          >
            {loading === "runs" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export run_entries.csv
          </Button>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">weight_entries</h2>
              <p className="text-xs text-muted-foreground">บันทึกน้ำหนักทั้งหมด</p>
            </div>
          </div>
          <Button
            id="export-weights-btn"
            data-testid="export-weights-btn"
            size="lg"
            variant="outline"
            className="w-full"
            disabled={loading !== null}
            onClick={() => void handleExport("weights")}
          >
            {loading === "weights" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export weight_entries.csv
          </Button>
        </Card>
      </div>

      <Card className="space-y-2 p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">สำหรับ Bot / RPA</p>
        <ul className="list-inside list-disc space-y-1 text-xs">
          <li>URL หน้านี้: <code>/app/export</code></li>
          <li>ปุ่มการวิ่ง: <code>#export-runs-btn</code> หรือ <code>[data-testid=&quot;export-runs-btn&quot;]</code></li>
          <li>ปุ่มน้ำหนัก: <code>#export-weights-btn</code> หรือ <code>[data-testid=&quot;export-weights-btn&quot;]</code></li>
          <li>API: <code>GET /api/export/runs</code>, <code>GET /api/export/weights</code> (Bearer JWT Super Admin)</li>
        </ul>
      </Card>
    </div>
  );
}
