import { useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { Body, Button, Eyebrow, Field, Screen, Title } from "@/src/ui";

export default function LoginScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setError(null);
    const message = await auth.signInWithGoogle();
    setBusy(false);
    if (message) setError(message);
  }

  async function reset() {
    setBusy(true);
    setResetNote(null);
    const message = await auth.resetPassword(email);
    setBusy(false);
    if (message) setError(message);
    else setResetNote("Check your school inbox for a reset link.");
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Eyebrow>UWCCR</Eyebrow>
        <Title>Sign in to your week</Title>
        <Body muted>
          School Google only. After that you land on your own schedule.
        </Body>
        <View className="mt-8 gap-3">
          <Button label="Continue with Google" onPress={() => void google()} busy={busy} />
          <Button
            label={showReset ? "Hide password reset" : "Staff password reset"}
            tone="ghost"
            onPress={() => setShowReset((value) => !value)}
          />
        </View>
        {showReset ? (
          <View className="mt-6">
            <Field
              label="School email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Button label="Send reset email" tone="ghost" onPress={() => void reset()} busy={busy} />
          </View>
        ) : null}
        {error ? <Text className="mt-4 font-sans text-[15px] text-error">{error}</Text> : null}
        {resetNote ? (
          <Text className="mt-4 font-sans text-[15px] text-primary">{resetNote}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
