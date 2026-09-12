export function setTeacherContext(_teacherId: string | null) {}

export function setSelectedPerson(_person: { kind: string; id: string } | null) {}

export function track(_name: string, _props?: Record<string, unknown>) {}

export function trackNow(_name: string, _props?: Record<string, unknown>) {}

export type ScheduleViewSource = "picker" | "login" | "class" | "header";
