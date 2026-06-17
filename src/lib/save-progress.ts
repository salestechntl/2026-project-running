export type SaveStepStatus = "pending" | "running" | "done" | "error";

export const RUN_SAVE_STEP_DEFS = [
  { id: "validate", label: "ตรวจสอบข้อมูลในฟอร์ม" },
  { id: "images", label: "เตรียมรูปภาพ" },
  { id: "record", label: "บันทึกข้อมูลการวิ่ง" },
  { id: "upload", label: "อัปโหลดรูปภาพ" },
  { id: "complete", label: "บันทึกเสร็จสมบูรณ์" },
] as const;

export type RunSaveStepId = (typeof RUN_SAVE_STEP_DEFS)[number]["id"];

export interface SaveStepState {
  id: RunSaveStepId;
  label: string;
  status: SaveStepStatus;
  detail?: string;
}

export function initialRunSaveSteps(): SaveStepState[] {
  return RUN_SAVE_STEP_DEFS.map((s) => ({ ...s, status: "pending" as const }));
}

export type SaveProgressUpdater = (
  stepId: RunSaveStepId,
  status: SaveStepStatus,
  detail?: string,
) => void;

export class SaveRunStepError extends Error {
  stepId: RunSaveStepId;

  constructor(stepId: RunSaveStepId, message: string) {
    super(message);
    this.name = "SaveRunStepError";
    this.stepId = stepId;
  }
}

export function countDoneSteps(steps: SaveStepState[]): number {
  return steps.filter((s) => s.status === "done").length;
}
