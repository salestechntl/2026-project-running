import { getAuthMode } from "./auth-config";
import { isCompressingPreview } from "./compress-image";
import { assertOnline, RunSavePartialError, userMessageFromError } from "./errors";
import { apiSaveRunRecord, apiUploadRunImages } from "./api";
import {
  SaveRunStepError,
  type RunSaveStepId,
  type SaveProgressUpdater,
} from "./save-progress";
import { saveRun as localSaveRun, type RunEntry } from "./store";

type RunSaveInput = Omit<RunEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
  id?: string;
  status?: RunEntry["status"];
  stravaImageRefs?: (string | undefined)[];
};

function prepareImages(
  images: string[] | undefined,
  refs: (string | undefined)[] | undefined,
): { count: number; refs?: string[]; detail: string } {
  const list = images ?? [];
  if (list.length === 0) {
    throw new SaveRunStepError("images", "แนบภาพกิจกรรมอย่างน้อย 1 รูป");
  }
  if (list.some(isCompressingPreview)) {
    throw new SaveRunStepError("images", "กำลังบีบอัดรูป กรุณารอสักครู่");
  }
  const newCount = list.filter((img) => img.startsWith("data:")).length;
  const keepCount = list.length - newCount;
  const detail =
    newCount > 0 && keepCount > 0
      ? `${list.length} รูป (อัปโหลดใหม่ ${newCount}, ใช้รูปเดิม ${keepCount})`
      : `${list.length} รูป`;
  return {
    count: list.length,
    refs: refs?.some(Boolean) ? refs.map((r) => r ?? "") : undefined,
    detail,
  };
}

async function runStep<T>(
  stepId: RunSaveStepId,
  onProgress: SaveProgressUpdater,
  detail: string | undefined,
  action: () => Promise<T>,
): Promise<T> {
  onProgress(stepId, "running", detail);
  try {
    const result = await action();
    onProgress(stepId, "done", detail);
    return result;
  } catch (e) {
    const message = userMessageFromError(e);
    onProgress(stepId, "error", message);
    throw e instanceof SaveRunStepError ? e : new SaveRunStepError(stepId, message);
  }
}

export async function saveRunEntryWithProgress(
  entry: RunSaveInput,
  onProgress: SaveProgressUpdater,
): Promise<RunEntry> {
  assertOnline();

  onProgress("images", "running");
  let imageInfo: ReturnType<typeof prepareImages>;
  try {
    imageInfo = prepareImages(entry.stravaImages, entry.stravaImageRefs);
    onProgress("images", "done", imageInfo.detail);
  } catch (e) {
    const message = userMessageFromError(e, "เตรียมรูปภาพไม่สำเร็จ");
    onProgress("images", "error", message);
    throw e instanceof SaveRunStepError ? e : new SaveRunStepError("images", message);
  }

  if (getAuthMode() === "local") {
    const run = await runStep("record", onProgress, "บันทึกในเครื่อง (โหมดสาธิต)", async () => {
      await new Promise((r) => setTimeout(r, 400));
      return localSaveRun(entry);
    });
    await runStep("upload", onProgress, "จัดเก็บรูปภาพ", async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    onProgress("complete", "done", "บันทึกเรียบร้อย");
    return run;
  }

  let runId = entry.id;

  await runStep("record", onProgress, runId ? "อัปเดตรายการเดิม" : "สร้างรายการใหม่", async () => {
    const run = await apiSaveRunRecord({
      ...entry,
      id: runId,
      stravaImages: [],
      stravaImageRefs: undefined,
    });
    runId = run.id;
    return run;
  });

  try {
    const final = await runStep(
      "upload",
      onProgress,
      `อัปโหลด ${imageInfo.count} รูป`,
      () =>
        apiUploadRunImages(runId!, entry.stravaImages ?? [], imageInfo.refs),
    );
    onProgress("complete", "done", "บันทึกเรียบร้อย");
    return final;
  } catch (e) {
    if (runId) {
      throw new RunSavePartialError(runId);
    }
    throw e;
  }
}
