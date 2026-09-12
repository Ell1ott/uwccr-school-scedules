export const STUDENT_QR_PREFIX = "uwccr:student:";

export function studentQrPayload(studentId: string) {
  return `${STUDENT_QR_PREFIX}${studentId}`;
}
