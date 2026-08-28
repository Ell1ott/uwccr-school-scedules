import type { ScheduleEvent } from "../types";
import { track } from "./analytics";
import { errorMessage } from "./errors";
import { notifyCancellation } from "./push";
import { supabase } from "./supabase";

export async function cancelClass(
  event: ScheduleEvent,
  teacherId: string,
  accessToken: string,
  reason: string,
  studentIds: string[],
) {
  if (!supabase) throw new Error("Sign in to cancel a class.");
  if (!event.date || !event.block) {
    throw new Error("This class has no date to cancel.");
  }
  try {
    const { data, error } = await supabase
      .from("cancellations")
      .insert({
        teacher_id: teacherId,
        on_date: event.date,
        block: event.block,
        subject: event.title,
        reason: reason || null,
        start_time: event.start,
        student_ids: studentIds,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    track("lesson_cancelled", {
      teacher_id: teacherId,
      date: event.date,
      block: event.block,
      subject: event.title,
      student_count: studentIds.length,
      has_reason: Boolean(reason),
      cancellation_id: data?.id ?? null,
    });
    if (data) void notifyCancellation(accessToken, data.id);
  } catch (error) {
    track("lesson_cancel_failed", { error: errorMessage(error) });
    throw error;
  }
}

export async function restoreClass(event: ScheduleEvent) {
  try {
    if (!supabase || !event.cancellationId) {
      throw new Error("Nothing to restore.");
    }
    const { error } = await supabase
      .from("cancellations")
      .delete()
      .eq("id", event.cancellationId);
    if (error) throw new Error(error.message);
    track("lesson_restored", {
      cancellation_id: event.cancellationId,
      date: event.date ?? null,
      block: event.block ?? null,
      subject: event.title,
    });
  } catch (error) {
    track("lesson_restore_failed", { error: errorMessage(error) });
    throw error;
  }
}

export async function saveClassNote(
  event: ScheduleEvent,
  teacherId: string,
  body: string,
) {
  if (!supabase) throw new Error("Sign in to add a note.");
  if (!event.date || !event.block) {
    throw new Error("This class has no date for a note.");
  }
  const trimmed = body.trim();
  const hasExisting = Boolean(event.noteId);
  try {
    if (!trimmed) {
      if (!event.noteId) return;
      const { error } = await supabase
        .from("lesson_notes")
        .delete()
        .eq("id", event.noteId);
      if (error) throw new Error(error.message);
      track("lesson_note_cleared", {
        has_existing: hasExisting,
        date: event.date,
        block: event.block,
        subject: event.title,
      });
      return;
    }
    const { error } = await supabase.from("lesson_notes").upsert(
      {
        teacher_id: teacherId,
        on_date: event.date,
        block: event.block,
        subject: event.title,
        body: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_id,on_date,block" },
    );
    if (error) throw new Error(error.message);
    track("lesson_note_saved", {
      has_existing: hasExisting,
      date: event.date,
      block: event.block,
      subject: event.title,
    });
  } catch (error) {
    track("lesson_note_failed", { error: errorMessage(error) });
    throw error;
  }
}

export async function clearClassNote(event: ScheduleEvent) {
  try {
    if (!supabase || !event.noteId) {
      throw new Error("Nothing to remove.");
    }
    const { error } = await supabase
      .from("lesson_notes")
      .delete()
      .eq("id", event.noteId);
    if (error) throw new Error(error.message);
    track("lesson_note_cleared", {
      has_existing: true,
      date: event.date ?? null,
      block: event.block ?? null,
      subject: event.title,
    });
  } catch (error) {
    track("lesson_note_failed", { error: errorMessage(error) });
    throw error;
  }
}
