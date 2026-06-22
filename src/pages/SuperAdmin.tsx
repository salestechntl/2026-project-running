import { useCallback, useEffect, useState } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  History, Users, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiOrgBatches, apiOrgImport } from "@/lib/api";
import type { OrgImportBatch, OrgImportResponse, OrgRowError } from "@/lib/auth-types";
import { Button, Card, Badge } from "@/components/ui";
import { readCsvTextFromFile } from "@/lib/csv-encoding";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const STATUS_LABEL: Record<OrgImportBatch["status"], string> = {
  preview: "พรีวิว",
  committed: "สำเร็จ",
  failed: "ล้มเหลว",
};

export default function SuperAdmin() {
  const { authMode } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<OrgImportResponse | null>(null);
  const [errors, setErrors] = useState<OrgRowError[]>([]);
  const [toast, setToast] = useState<string>();
  const [batches, setBatches] = useState<OrgImportBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (authMode !== "api") {
      setHistoryLoading(false);
      return;
    }
    try {
      setBatches(await apiOrgBatches());
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, [authMode]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(undefined), 5000);
  }

  function onFileSelect(f: File | null) {
    setFile(f);
    setPreview(null);
    setErrors([]);
    if (!f) {
      setCsvText("");
      return;
    }
    setFileLoading(true);
    void readCsvTextFromFile(f)
      .then((text) => setCsvText(text))
      .catch(() => {
        setCsvText("");
        flash("อ่านไฟล์ไม่สำเร็จ — ลองบันทึก CSV ใหม่จาก Excel");
      })
      .finally(() => setFileLoading(false));
  }

  async function runPreview() {
    if (!csvText.trim()) {
      flash("กรุณาเลือกไฟล์ CSV ก่อน");
      return;
    }
    setLoading(true);
    setPreview(null);
    setErrors([]);
    try {
      const result = await apiOrgImport("preview", file?.name ?? "import.csv", csvText);
      if (!result.ok && result.errors?.length) {
        setErrors(result.errors);
        setPreview(null);
        flash(`พบข้อผิดพลาด ${result.error_count} รายการ — แก้ไขไฟล์ก่อนนำเข้า`);
        return;
      }
      setPreview(result);
      flash(`ตรวจสอบแล้ว — พร้อมนำเข้า ${result.row_count} คน`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ตรวจสอบไม่สำเร็จ";
      flash(msg);
    } finally {
      setLoading(false);
    }
  }

  async function runCommit() {
    if (!csvText.trim() || !preview?.ok) return;
    if (!confirm(`ยืนยันนำเข้า ${preview.row_count} คน?\nพนักงานที่ไม่อยู่ในไฟล์จะถูก deactivate`)) return;

    setLoading(true);
    try {
      const result = await apiOrgImport("commit", file?.name ?? "import.csv", csvText);
      setPreview(result);
      setErrors([]);
      flash(result.message ?? "นำเข้าสำเร็จ");
      setFile(null);
      setCsvText("");
      await loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ";
      flash(msg);
    } finally {
      setLoading(false);
    }
  }

  if (authMode !== "api") {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-primary" />
        <h1 className="font-display text-xl font-bold">โหมด Demo</h1>
        <p className="text-sm text-muted-foreground">
          การอัปโหลดโครงสร้างองค์กรต้องใช้ Supabase + API (`npm run dev:full`)
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          จัดการโครงสร้างองค์กร
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          อัปโหลดไฟล์ CSV รายเดือน — ระบบจะ upsert พนักงานและ deactivate รายชื่อที่หายไป
        </p>
      </header>

      {toast && (
        <div
          role="status"
          className="flex animate-scale-in items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {toast}
        </div>
      )}

      {/* Upload */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">อัปโหลดไฟล์ CSV</h2>
          </div>
          <a
            href="/org-template.csv"
            download="org-template.csv"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Download className="h-4 w-4" />
            ดาวน์โหลด Template
          </a>
        </div>

        <label
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
            file ? "border-primary/40 bg-primary/[0.04]" : "border-border hover:border-primary/30 hover:bg-muted/40",
          )}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {file ? file.name : "ลากไฟล์มาวาง หรือคลิกเลือก"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            รองรับ UTF-8 และ CSV จาก Excel (ภาษาไทย) — ระบบตรวจ encoding อัตโนมัติ
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={runPreview} disabled={loading || fileLoading || !csvText.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            ตรวจสอบ (Preview)
          </Button>
          <Button
            variant="secondary"
            onClick={runCommit}
            disabled={loading || !preview?.ok}
          >
            ยืนยันนำเข้า
          </Button>
        </div>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-danger/30 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle className="h-4 w-4" />
            พบข้อผิดพลาด {errors.length} รายการ
          </h3>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {errors.map((e, i) => (
              <li key={i}>
                แถว {e.row} · {e.employee_id || "—"} — {e.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Preview */}
      {preview?.ok && preview.summary && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">สรุปก่อนนำเข้า</h3>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="tnum text-2xl font-bold text-foreground">{preview.summary.upsert}</p>
              <p className="text-xs text-muted-foreground">อัปเดต/เพิ่ม</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="tnum text-2xl font-bold text-primary">{preview.summary.new}</p>
              <p className="text-xs text-muted-foreground">ใหม่</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="tnum text-2xl font-bold text-danger">{preview.summary.deactivate}</p>
              <p className="text-xs text-muted-foreground">deactivate</p>
            </div>
          </div>

          {preview.rows && preview.rows.length > 0 && (
            <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">รหัส</th>
                    <th className="px-3 py-2 font-semibold">ชื่อ</th>
                    <th className="px-3 py-2 font-semibold">แผนก</th>
                    <th className="px-3 py-2 font-semibold">หัวหน้า</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.slice(0, 50).map((r) => (
                    <tr key={r.employee_id}>
                      <td className="tnum px-3 py-2">{r.employee_id}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.department}</td>
                      <td className="tnum px-3 py-2">{r.manager_id ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 50 && (
                <p className="p-2 text-center text-xs text-muted-foreground">
                  แสดง 50 จาก {preview.rows.length} แถว
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* History */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">ประวัติการนำเข้า</h3>
        </div>
        {historyLoading ? (
          <p className="p-5 text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : batches.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">ยังไม่มีประวัติการนำเข้า</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">วันที่</th>
                  <th className="px-5 py-2.5 font-semibold">ไฟล์</th>
                  <th className="px-5 py-2.5 font-semibold">แถว</th>
                  <th className="px-5 py-2.5 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                      {formatDate(b.uploaded_at)}
                    </td>
                    <td className="px-5 py-3">{b.file_name}</td>
                    <td className="tnum px-5 py-3">{b.row_count}</td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={b.status === "committed" ? "success" : b.status === "failed" ? "warning" : "neutral"}
                      >
                        {STATUS_LABEL[b.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
