import { updateCas } from "@shared/lib/cas";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useCatalog } from "@/src/catalog";
import { Body, Button, Field, Screen, Scroll } from "@/src/ui";

export default function EditCasScreen() {
  const { casId } = useLocalSearchParams<{ casId: string }>();
  const { casGroups } = useCatalog();
  const group = casGroups.find((item) => item.id === casId);
  const [title, setTitle] = useState(group?.title ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [location, setLocation] = useState(group?.location ?? "");
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
    const message = await updateCas(group!.id, {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
    });
    setBusy(false);
    if (message) setError(message);
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
        <Button label="Save" onPress={() => void submit()} busy={busy} />
        {error ? <Text className="mt-3 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}
