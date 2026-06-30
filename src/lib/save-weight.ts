import { getAuthMode } from "./auth-config";
import {
  isCompressingPreview,
} from "./compress-image";
import { apiSaveWeight } from "./api";
import {
  SaveWeightStepError,
  type WeightSaveProgressUpdater,
  type WeightSaveStepId,
} from "./save-progress";
import { saveWeight as localSaveWeight, type WeightEntry } from "./store";

const MAX_WEIGHT_IMAGES = 2;

type WeightSaveInput = Omit<WeightEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
  id?: string;
  status?: WeightEntry["status"];
  proofImageRefs?: (string | undefined)[];
};

function prepareImages(
  images: string[] | undefined,
  refs: (string | undefined)[] | undefined,
): { count: number; refs?: string[]; detail: string } {
  const list = images ?? [];
  if (list.length === 0) {
    throw new SaveWeightStepError("image", "แนบภาพน้ำหนักอย่างน้อย 1 รูป");
  }
  if (list.some(isCompressingPreview)) {
    throw new SaveWeightStepError("image", "กำลังบีบอัดรูป กรุณารอสักครู่");
  }
  if (list.length > MAX_WEIGHT_IMAGES) {
    throw new SaveWeightStepError("image", `แนบได้สูงสุด ${MAX_WEIGHT_IMAGES} รูป`);
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
  let imageInfo: ReturnType<typeof prepareImages>;
  try {
    imageInfo = prepareImages(entry.proofImages, entry.proofImageRefs);
    onProgress("image", "done", imageInfo.detail);
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
