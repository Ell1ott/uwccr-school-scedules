import { searchPeople } from "@shared/lib/people";
import {
  createReachRequest,
  crNowStamp,
  leaveTypeMeta,
  localToIso,
  REACH_TRANSPORTS,
  suggestedEnd,
  updateReachRequest,
  type ReachLeaveType,
  type ReachRequest,
  type ReachTransportMode,
} from "@shared/lib/reach";
import { crDate, crTime } from "@shared/lib/schoolEvents";
import type { Student } from "@shared/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReachKindPicker } from "@/src/forms/ReachKindPicker";
import {
  ReachButton,
  ReachField,
  ReachGroup,
  ReachLabel,
  ReachPage,
  ReachRow,
} from "@/src/reach-ui";
import { reach } from "@/src/theme";

function parseLocal(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function toDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function formatWhen(date: string, time: string) {
  const value = parseLocal(date, time);
  return {
    clock: value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    day: value.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
  };
}

export function ReachEditor({
  students,
  editing,
}: {
  students: Student[];
  editing?: ReachRequest | null;
}) {
  const insets = useSafeAreaInsets();
  const live = crNowStamp(new Date());
  const [step, setStep] = useState<"kind" | "details">(editing ? "details" : "kind");
  const [leaveType, setLeaveType] = useState<ReachLeaveType>(
    editing?.leaveType ?? "day",
  );
  const [startDate, setStartDate] = useState(
    editing ? crDate(editing.startsAt) : live.date,
  );
  const [startTime, setStartTime] = useState(
    editing ? crTime(editing.startsAt) : live.time,
  );
  const [endDate, setEndDate] = useState(
    editing ? crDate(editing.endsAt) : suggestedEnd("day", live.date).date,
  );
  const [endTime, setEndTime] = useState(
    editing ? crTime(editing.endsAt) : suggestedEnd("day", live.date).time,
  );
  const [destination, setDestination] = useState(editing?.destination ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [hostName, setHostName] = useState(editing?.hostName ?? "");
  const [hostPhone, setHostPhone] = useState(editing?.hostPhone ?? "");
  const [hostAddress, setHostAddress] = useState(editing?.hostAddress ?? "");
  const [transports, setTransports] = useState<ReachTransportMode[]>(
    editing?.transports.length ? editing.transports : ["walking"],
  );
  const [query, setQuery] = useState("");
  const [companions, setCompanions] = useState<string[]>(
    editing?.companions.map((companion) => companion.studentId) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [editingWhen, setEditingWhen] = useState<"start" | "end" | null>(null);
  const meta = leaveTypeMeta(leaveType);
  const people = useMemo(
    () => searchPeople(students, query).slice(0, 8),
    [students, query],
  );
  const start = formatWhen(startDate, startTime);
  const end = formatWhen(endDate, endTime);

  function pickType(type: ReachLeaveType) {
    setLeaveType(type);
    const next = suggestedEnd(type, startDate);
    setEndDate(next.date);
    setEndTime(next.time);
    setStep("details");
  }

  async function submit() {
    if (!destination.trim()) {
      Alert.alert("Destination", "Where are you going?");
      return;
    }
    setBusy(true);
    const payload = {
      leaveType,
      startsAt: localToIso(startDate, startTime),
      endsAt: localToIso(endDate, endTime),
      destination: destination.trim(),
      notes: notes.trim(),
      hostName: hostName.trim(),
      hostPhone: hostPhone.trim(),
      hostAddress: hostAddress.trim(),
      transports,
      companionStudentIds: companions,
      files: [],
    };
    const result = editing
      ? await updateReachRequest({ ...payload, requestId: editing.id })
      : await createReachRequest(payload);
    setBusy(false);
    if (result.error) {
      Alert.alert("Could not save", result.error);
      return;
    }
    if (result.uploadError) Alert.alert("Upload", result.uploadError);
    router.back();
  }

  if (step === "kind") {
    return (
      <ReachPage>
        <ReachKindPicker onPick={pickType} />
      </ReachPage>
    );
  }

  return (
    <ReachPage>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom, paddingTop: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => setStep("kind")} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: reach.blue, fontSize: 17, fontWeight: "600" }}>{meta.label}</Text>
        </Pressable>

        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <ReachLabel>Where</ReachLabel>
          <ReachGroup>
            <ReachField
              label="Destination"
              value={destination}
              onChangeText={setDestination}
              autoFocus={!editing}
            />
          </ReachGroup>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <ReachLabel>When</ReachLabel>
          <ReachGroup>
            <View style={{ flexDirection: "row" }}>
              <WhenColumn
                label="Leaving"
                clock={start.clock}
                day={start.day}
                onPress={() => setEditingWhen(editingWhen === "start" ? null : "start")}
              />
              <View style={{ width: 0.5, backgroundColor: reach.line }} />
              <WhenColumn
                label="Back by"
                clock={end.clock}
                day={end.day}
                onPress={() => setEditingWhen(editingWhen === "end" ? null : "end")}
              />
            </View>
            {editingWhen ? (
              <DateTimePicker
                value={
                  editingWhen === "start"
                    ? parseLocal(startDate, startTime)
                    : parseLocal(endDate, endTime)
                }
                mode="datetime"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, value) => {
                  if (!value) return;
                  if (editingWhen === "start") {
                    setStartDate(toDate(value));
                    setStartTime(toTime(value));
                  } else {
                    setEndDate(toDate(value));
                    setEndTime(toTime(value));
                  }
                  if (Platform.OS !== "ios") setEditingWhen(null);
                }}
              />
            ) : null}
          </ReachGroup>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <ReachLabel>How</ReachLabel>
          <ReachGroup>
            <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 }}>
              {REACH_TRANSPORTS.map((item) => {
                const selected = transports.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setTransports((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                    style={{
                      minHeight: 34,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      justifyContent: "center",
                      backgroundColor: selected ? reach.ink : reach.bg,
                    }}
                  >
                    <Text style={{ color: selected ? "#fff" : reach.ink, fontSize: 14 }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ReachGroup>
        </View>

        {meta.emphasizeHost ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <ReachLabel>Host</ReachLabel>
            <ReachGroup>
              <ReachField label="Name" value={hostName} onChangeText={setHostName} />
              <ReachField label="Phone" value={hostPhone} onChangeText={setHostPhone} />
              <ReachField label="Address" value={hostAddress} onChangeText={setHostAddress} />
            </ReachGroup>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <ReachLabel>Note</ReachLabel>
          <ReachGroup>
            <ReachField label="Optional" value={notes} onChangeText={setNotes} multiline />
          </ReachGroup>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <ReachLabel>Companions</ReachLabel>
          <ReachGroup>
            <ReachField
              label="Search students"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {people.map((student, index) => (
              <ReachRow
                key={student.id}
                last={index === people.length - 1}
                onPress={() =>
                  setCompanions((current) =>
                    current.includes(student.id)
                      ? current.filter((id) => id !== student.id)
                      : [...current, student.id],
                  )
                }
              >
                <Text style={{ flex: 1, color: reach.ink, fontSize: 17 }}>
                  {student.name}
                </Text>
                <Text style={{ color: reach.blue, fontSize: 17 }}>
                  {companions.includes(student.id) ? "Added" : "Add"}
                </Text>
              </ReachRow>
            ))}
          </ReachGroup>
        </View>
      </ScrollView>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: reach.bg,
        }}
      >
        <ReachButton
          tone="cta"
          label={
            busy
              ? editing
                ? "Saving…"
                : "Sending…"
              : editing
                ? meta.needsApproval
                  ? "Save for approval"
                  : "Save"
                : meta.needsApproval
                  ? "Send for approval"
                  : "Submit"
          }
          onPress={() => void submit()}
          disabled={busy}
        />
      </View>
    </ReachPage>
  );
}

function WhenColumn({
  label,
  clock,
  day,
  onPress,
}: {
  label: string;
  clock: string;
  day: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, padding: 16 }}>
      <Text style={{ color: reach.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: reach.ink, fontSize: 20, fontWeight: "600", marginTop: 4 }}>
        {clock}
      </Text>
      <Text style={{ color: reach.muted, fontSize: 13, marginTop: 2 }}>{day}</Text>
    </Pressable>
  );
}
