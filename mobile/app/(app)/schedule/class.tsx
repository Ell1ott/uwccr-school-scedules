import { mailtoBcc } from "@shared/data/studentEmails";
import { formatTime } from "@shared/lib/buildSchedule";
import { formatLongDate } from "@shared/lib/calendar";
import {
  cancelClass,
  clearClassNote,
  restoreClass,
  saveClassNote,
} from "@shared/lib/classActions";
import {
  classmatesFor,
  initials,
  meetingsForBlock,
  studyMatesFor,
} from "@shared/lib/classDetail";
import { findById } from "@shared/lib/people";
import { COHORT_TABS } from "@shared/lib/school";
import { teacherIdForName } from "@shared/lib/teachers";
import { toneForEvent } from "@shared/lib/tones";
import type { CohortId } from "@shared/types";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { LessonMark } from "@/src/lib/icons";
import { supabase } from "@/src/lib/supabase";
import { toneColors } from "@/src/theme";
import { Body, Button, Chip, Field, Screen, Scroll } from "@/src/ui";

export default function ClassScreen() {
  const auth = useAuth();
  const catalog = useCatalog();
  const event = catalog.openClass;
  const [reason, setReason] = useState("");
  const [noteBody, setNoteBody] = useState(event?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rosterCohort, setRosterCohort] = useState<CohortId>(
    catalog.student?.cohort ?? "IB1",
  );

  const viewerKind = catalog.teacher ? "teacher" : "student";
  const canManage =
    Boolean(auth.teacherId) &&
    Boolean(event?.teacher) &&
    teacherIdForName(event?.teacher ?? "") === auth.teacherId;
  const tone = event ? toneColors(toneForEvent(event, catalog.palette)) : null;

  const classmates = useMemo(() => {
    if (!event) return [];
    return event.kind === "study"
      ? studyMatesFor(catalog.students, event, rosterCohort)
      : classmatesFor(
          catalog.students,
          event,
          viewerKind === "teacher"
            ? { ignoreLevel: true }
            : catalog.student
              ? { cohort: catalog.student.cohort }
              : undefined,
        );
  }, [event, catalog.students, catalog.student, viewerKind, rosterCohort]);

  if (!event || !tone) {
    return (
      <Screen>
        <Body muted>No class selected.</Body>
      </Screen>
    );
  }

  const meetings = event.block
    ? meetingsForBlock(event.block, catalog.communityMeeting)
    : [];

  async function onCancel() {
    if (!event || !auth.teacherId || !auth.session) return;
    setBusy(true);
    setError(null);
    try {
      await cancelClass(
        event,
        auth.teacherId,
        auth.session.access_token,
        reason,
        classmates.map((mate) => mate.id),
      );
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!event) return;
    setBusy(true);
    try {
      await restoreClass(event);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNote() {
    if (!event || !auth.teacherId) return;
    setBusy(true);
    try {
      await saveClassNote(event, auth.teacherId, noteBody);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note.");
    } finally {
      setBusy(false);
    }
  }

  const emails = classmates
    .map((mate) => mate.email)
    .filter((email): email is string => Boolean(email));

  return (
    <Screen>
      <Scroll>
        <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: tone.bg }}>
          <View className="px-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-[13px]" style={{ color: tone.text }}>
                {formatTime(event.start)} – {formatTime(event.end)}
              </Text>
              <LessonMark subject={event.title} />
            </View>
            <Text className="mt-1 font-bold text-[24px]" style={{ color: tone.text }}>
              {event.title}
            </Text>
            <Text className="mt-1 font-sans" style={{ color: tone.text }}>
              {[event.room, event.teacher, event.date ? formatLongDate(event.date) : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
        {meetings.length ? (
          <Text className="mt-4 font-sans text-on-surface-variant">
            {meetings.map((meeting) => `${meeting.dayShort} ${meeting.start}`).join(" · ")}
          </Text>
        ) : null}
        {event.kind === "study" ? (
          <View className="mt-4 flex-row">
            {COHORT_TABS.map((tab) => (
              <Chip
                key={tab.id}
                label={tab.label}
                selected={rosterCohort === tab.id}
                onPress={() => setRosterCohort(tab.id)}
              />
            ))}
          </View>
        ) : null}
        <Text className="mb-2 mt-5 font-medium text-on-surface-variant">
          {classmates.length} {event.kind === "study" ? "study mates" : "classmates"}
        </Text>
        {classmates.map((mate) => (
          <Pressable
            key={mate.id}
            className="flex-row items-center py-2"
            onPress={() => {
              catalog.choosePerson({ kind: "student", id: mate.id });
              router.back();
            }}
          >
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-surface-container">
              <Text className="font-medium text-[12px]">{initials(mate.name)}</Text>
            </View>
            <Text className="font-sans text-[16px] text-on-surface">{mate.name}</Text>
          </Pressable>
        ))}
        {canManage && emails.length && supabase ? (
          <View className="mt-4">
            <Button
              label="Email class"
              tone="ghost"
              onPress={() => void Linking.openURL(mailtoBcc(emails, event.title) ?? "")}
            />
          </View>
        ) : null}
        {canManage ? (
          <View className="mt-6 gap-3">
            <Field
              label="Lesson note"
              value={noteBody}
              onChangeText={setNoteBody}
              multiline
            />
            <Button label="Save note" onPress={() => void onSaveNote()} busy={busy} />
            {event.noteId ? (
              <Button
                label="Clear note"
                tone="ghost"
                onPress={() => void clearClassNote(event)}
              />
            ) : null}
            {event.cancelled ? (
              <Button label="Restore class" tone="ghost" onPress={() => void onRestore()} busy={busy} />
            ) : (
              <>
                <Field
                  label="Cancel reason"
                  value={reason}
                  onChangeText={setReason}
                />
                <Button
                  label="Cancel class"
                  tone="danger"
                  onPress={() => void onCancel()}
                  busy={busy}
                />
              </>
            )}
          </View>
        ) : null}
        {event.teacher ? (
          <Pressable
            className="mt-6"
            onPress={() => {
              const id = teacherIdForName(event.teacher ?? "");
              if (id) {
                catalog.choosePerson({ kind: "teacher", id });
                router.back();
              }
            }}
          >
            <Text className="font-medium text-primary">
              View {findById(catalog.teachers, teacherIdForName(event.teacher) ?? "")?.name ?? event.teacher}
            </Text>
          </Pressable>
        ) : null}
        {error ? <Text className="mt-3 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}
