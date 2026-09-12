import { sendFeedback, type FeedbackKind } from "@shared/lib/feedback";
import { PALETTE_OPTIONS } from "@shared/lib/tones";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { Body, Button, Chip, Field, Screen, Scroll, Title } from "@/src/ui";

export default function SettingsScreen() {
  const auth = useAuth();
  const catalog = useCatalog();
  const [kind, setKind] = useState<FeedbackKind>("general");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const result = await sendFeedback(kind, message);
    setBusy(false);
    setNote(result ?? "Thanks — sent.");
    if (!result) setMessage("");
  }

  return (
    <Screen>
      <Scroll>
        <Title>Settings</Title>
        <Text className="mt-6 mb-2 font-medium text-on-surface-variant">Palette</Text>
        <View className="flex-row flex-wrap">
          {PALETTE_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={catalog.palette === option.id}
              onPress={() => catalog.setPaletteId(option.id)}
            />
          ))}
        </View>
        <Pressable
          className="mt-2"
          onPress={() => catalog.setLessonIcons(!catalog.showLessonIcons)}
        >
          <Text className="font-medium text-primary">
            Lesson icons: {catalog.showLessonIcons ? "on" : "off"}
          </Text>
        </Pressable>
        <Text className="mt-8 mb-2 font-medium text-on-surface-variant">Feedback</Text>
        <View className="flex-row">
          {(["general", "bug", "feature"] as FeedbackKind[]).map((id) => (
            <Chip key={id} label={id} selected={kind === id} onPress={() => setKind(id)} />
          ))}
        </View>
        <Field
          label="What's on your mind"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <Button label="Send feedback" onPress={() => void send()} busy={busy} />
        {note ? <Text className="mt-3 font-sans text-primary">{note}</Text> : null}
        <View className="mt-10">
          <Body muted>
            Signed in as {auth.displayName ?? auth.session?.user.email}
          </Body>
          <View className="mt-4">
            <Button label="Sign out" tone="ghost" onPress={() => void auth.signOut()} />
          </View>
        </View>
      </Scroll>
    </Screen>
  );
}
