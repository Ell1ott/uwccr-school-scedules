import {
  CAS_MODES,
  casOccurrenceStamps,
  createCasSessions,
  defaultCasUntilDate,
  todayStamp,
  type CasSessionMode,
} from "@shared/lib/cas";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useCatalog } from "@/src/catalog";
import { Body, Button, Chip, Field, Screen, Scroll } from "@/src/ui";

export default function NewCasSessionScreen() {
  const { casId } = useLocalSearchParams<{ casId: string }>();
  const { casGroups } = useCatalog();
  const group = casGroups.find((item) => item.id === casId);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(group?.location ?? "");
  const [date, setDate] = useState(todayStamp());
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [mode, setMode] = useState<CasSessionMode>("mandatory");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) {
    return (
      <Screen>
        <Body muted>CAS group not found.</Body>
      </Screen>
    );
  }

  async function submit() {
    setBusy(true);
    const stamps = casOccurrenceStamps(date, startTime, endTime, "none", defaultCasUntilDate());
    const message = await createCasSessions({
      casId: group!.id,
      label: label.trim(),
      description: description.trim(),
      location: location.trim(),
      starts: stamps.starts,
      ends: stamps.ends,
      mode,
      capacity: capacity.trim() ? Number(capacity) : null,
      freq: null,
      untilDate: null,
    });
    setBusy(false);
    if (message) setError(message);
    else router.back();
  }

  return (
    <Screen>
      <Scroll>
        <Field label="Label" value={label} onChangeText={setLabel} />
        <Field label="Where" value={location} onChangeText={setLocation} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <Field label="Start" value={startTime} onChangeText={setStartTime} />
        <Field label="End" value={endTime} onChangeText={setEndTime} />
        <View className="flex-row flex-wrap">
          {CAS_MODES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={mode === item.id}
              onPress={() => setMode(item.id)}
            />
          ))}
        </View>
        {mode === "signup" ? (
          <Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
        ) : null}
        <Button label="Create session" onPress={() => void submit()} busy={busy} />
        {error ? <Text className="mt-3 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}
