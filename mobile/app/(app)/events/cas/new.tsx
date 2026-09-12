import { createCas, notifyCasModeration } from "@shared/lib/cas";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { Button, Field, Screen, Scroll } from "@/src/ui";

const SITE = "https://uwccr-schedule.vercel.app";

export default function NewCasScreen() {
  const auth = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("Give the CAS a title.");
      return;
    }
    setBusy(true);
    const created = await createCas({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      leaderStudentIds: [],
    });
    if (created.error) {
      setBusy(false);
      setError(created.error);
      return;
    }
    if (auth.role === "student" && created.moderationToken) {
      await notifyCasModeration(created.moderationToken, SITE);
    }
    setBusy(false);
    if (created.casId) router.replace(`/(app)/events/cas/${created.casId}`);
    else router.back();
  }

  return (
    <Screen>
      <Scroll>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Where" value={location} onChangeText={setLocation} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Button label="Create CAS" onPress={() => void submit()} busy={busy} />
        {error ? <Text className="mt-3 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}
