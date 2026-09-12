import {
  cancelCasSession,
  cancelCasSignup,
  formatCasWhen,
  signupCasSession,
} from "@shared/lib/cas";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useCatalog } from "@/src/catalog";
import { Body, Button, Screen, Scroll, Title } from "@/src/ui";

export default function CasSessionScreen() {
  const { casId, sessionId } = useLocalSearchParams<{
    casId: string;
    sessionId: string;
  }>();
  const { casGroups } = useCatalog();
  const group = casGroups.find((item) => item.id === casId);
  const session = group?.sessions.find((item) => item.id === sessionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group || !session) {
    return (
      <Screen>
        <Body muted>Session not found.</Body>
      </Screen>
    );
  }

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Screen>
      <Scroll>
        <Text className="font-medium text-on-surface-variant">{formatCasWhen(session)}</Text>
        <Title>{session.title}</Title>
        <Body muted>
          {[session.location || group.location, session.mode, session.status]
            .filter(Boolean)
            .join(" · ")}
        </Body>
        {session.description ? (
          <Text className="mt-4 font-sans text-on-surface">{session.description}</Text>
        ) : null}
        <View className="mt-6 gap-3">
          {session.mode === "signup" && !session.mySignup ? (
            <Button
              label="Sign up"
              onPress={() =>
                void run(async () => {
                  const result = await signupCasSession(session.id);
                  return result.error;
                })
              }
              busy={busy}
            />
          ) : null}
          {session.mySignup ? (
            <Button
              label="Cancel signup"
              tone="ghost"
              onPress={() => void run(() => cancelCasSignup(session.id))}
            />
          ) : null}
          {group.iAmLeader ? (
            <Button
              label="Cancel session"
              tone="danger"
              onPress={() =>
                void run(async () => {
                  const message = await cancelCasSession(session.id, false);
                  if (!message) router.back();
                  return message;
                })
              }
            />
          ) : null}
        </View>
        {error ? <Text className="mt-4 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}
