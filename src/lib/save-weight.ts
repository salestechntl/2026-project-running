import { getAuthMode } from "./auth-config";
import { apiSaveWeight } from "./api";
import {
  SaveWeightStepError,
  type WeightSaveProgressUpdater,
  type WeightSaveStepId,
} from "./save-progress";
import { saveWeight as localSaveWeight, type WeightEntry } from "./store";

type WeightSaveInput = Omit<WeightEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: WeightEntry["status"];
  proofImageRef?: string;
};

async function runStep<T>(
  stepId: WeightSaveStepId,
  onProgress: WeightSaveProgressUpdater,
  detail: string | undefined,
  action: () => Promise<T>,
): Promise<T> {
  onProgress(stepId, "running", detail);
  try {
    const result = await action();
    onProgress(stepId, "done", detail);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ";
    onProgress(stepId, "error", message);
    throw e instanceof SaveWeightStepError ? e : new SaveWeightStepError(stepId, message);
  }
}

export async function saveWeightEntryWithProgress(
  entry: WeightSaveInput,
  onProgress: WeightSaveProgressUpdater,
  opts?: { isUpdate?: boolean },
): Promise<WeightEntry> {
  onProgress("image", "running");
  try {
    if (!entry.proofImage) {
      throw new SaveWeightStepError("image", "แนบภาพน้ำหนัก");
    }
    const detail = entry.proofImage.startsWith("data:")
      ? "อัปโหลดรูปใหม่"
      : "ใช้รูปเดิม";
    onProgress("image", "done", detail);
  } catch (e) {
    const message = e instanceof Error ? e.message : "เตรียมรูปภาพไม่สำเร็จ";
    onProgress("image", "error", message);
    throw e instanceof SaveWeightStepError ? e : new SaveWeightStepError("image", message);
  }

  const isUpdate = opts?.isUpdate ?? false;

  if (getAuthMode() === "local") {
    const weight = await runStep("record", onProgress, "บันทึกในเครื่อง (โหมดสาธิต)", async () => {
      await new Promise((r) => setTimeout(r, 400));
      return localSaveWeight(entry);
    });
    onProgress("complete", "done", "บันทึกเรียบร้อย");
    return weight;
  }

  const weight = await runStep(
    "record",
    onProgress,
    isUpdate ? "อัปเดตรายการเดิม" : "สร้างรายการใหม่",
    () => apiSaveWeight(entry),
  );

  onProgress("complete", "done", "บันทึกเรียบร้อย");
  return weight;
}
