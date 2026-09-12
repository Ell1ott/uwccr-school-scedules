import { toISODate } from "@shared/lib/calendar";
import {
  createSchoolEvent,
  crDate,
  crTime,
  expandAudience,
  localToIso,
  notifyEventModeration,
  occurrenceStamps,
  updateSchoolEvent,
  type EventTarget,
  type SchoolEvent,
} from "@shared/lib/schoolEvents";
import type { EventMode, Student } from "@shared/types";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { Button, Chip, Field, Scroll } from "@/src/ui";

const MODES: { id: EventMode; label: string }[] = [
  { id: "mandatory", label: "Mandatory" },
  { id: "invite", label: "Invite" },
  { id: "open", label: "Open" },
  { id: "info", label: "Announcement" },
];

const SITE = "https://uwccr-schedule.vercel.app";

export function EventEditor({
  students,
  editing,
}: {
  students: Student[];
  editing?: SchoolEvent | null;
}) {
  const auth = useAuth();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [date, setDate] = useState(editing ? crDate(editing.startsAt) : toISODate(new Date()));
  const [endDate, setEndDate] = useState(editing ? crDate(editing.endsAt) : toISODate(new Date()));
  const [startTime, setStartTime] = useState(
    editing && !editing.allDay ? crTime(editing.startsAt) : "18:30",
  );
  const [endTime, setEndTime] = useState(
    editing && !editing.allDay ? crTime(editing.endsAt) : "19:30",
  );
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [mode, setMode] = useState<EventMode>(editing?.mode ?? "invite");
  const [capacity, setCapacity] = useState(
    editing?.capacity != null ? String(editing.capacity) : "",
  );
  const [audience, setAudience] = useState<"all" | "IB1" | "IB2">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets: EventTarget[] = useMemo(() => {
    if (audience === "all") return [{ kind: "all_students", payload: {} }];
    return [{ kind: "cohort", payload: { cohort: audience } }];
  }, [audience]);

  const count = expandAudience(students, targets).length;

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Give the event a title.");
      return;
    }
    setBusy(true);
    if (editing) {
      const message = await updateSchoolEvent(editing.id, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startsAt: localToIso(date, allDay ? "00:00" : startTime),
        endsAt: localToIso(endDate, allDay ? "23:59" : endTime),
        allDay,
      });
      setBusy(false);
      if (message) setError(message);
      else router.back();
      return;
    }
    const stamps = occurrenceStamps(
      date,
      startTime,
      endTime,
      allDay,
      "none",
      date,
      endDate,
    );
    const created = await createSchoolEvent({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      starts: stamps.starts,
      ends: stamps.ends,
      allDay,
      mode,
      capacity: capacity.trim() ? Number(capacity) : null,
      targets,
      audience: expandAudience(students, targets),
      freq: null,
      untilDate: null,
    });
    if (created.error) {
      setBusy(false);
      setError(created.error);
      return;
    }
    if (auth.role === "student" && created.moderationToken) {
      await notifyEventModeration(created.moderationToken, SITE);
    }
    setBusy(false);
    router.back();
  }

  return (
    <Scroll>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Where" value={location} onChangeText={setLocation} />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Field label="Start date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Field label="End date" value={endDate} onChangeText={setEndDate} />
      {allDay ? null : (
        <>
          <Field label="Start time (HH:MM)" value={startTime} onChangeText={setStartTime} />
          <Field label="End time" value={endTime} onChangeText={setEndTime} />
        </>
      )}
      <Chip
        label={allDay ? "All day" : "Timed"}
        selected
        onPress={() => setAllDay((value) => !value)}
      />
      {!editing ? (
        <>
          <View className="mt-3 flex-row flex-wrap">
            {MODES.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={mode === item.id}
                onPress={() => setMode(item.id)}
              />
            ))}
          </View>
          <View className="mt-2 flex-row">
            {(["all", "IB1", "IB2"] as const).map((id) => (
              <Chip
                key={id}
                label={id === "all" ? "All students" : id}
                selected={audience === id}
                onPress={() => setAudience(id)}
              />
            ))}
          </View>
          <Text className="mb-3 font-sans text-on-surface-variant">{count} people</Text>
          {mode === "open" ? (
            <Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          ) : null}
        </>
      ) : null}
      <Button label={editing ? "Save" : "Create event"} onPress={() => void submit()} busy={busy} />
      {error ? <Text className="mt-3 text-error">{error}</Text> : null}
    </Scroll>
  );
}
