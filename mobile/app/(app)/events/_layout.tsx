import { Stack } from "expo-router";
import { colors } from "@/src/theme";

export default function EventsStack() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
        contentStyle: { backgroundColor: colors.surfaceDim },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New event" }} />
      <Stack.Screen name="[eventId]/index" options={{ title: "Event" }} />
      <Stack.Screen name="[eventId]/edit" options={{ title: "Edit event" }} />
      <Stack.Screen name="cas/new" options={{ title: "New CAS" }} />
      <Stack.Screen name="cas/[casId]/index" options={{ title: "CAS" }} />
      <Stack.Screen name="cas/[casId]/edit" options={{ title: "Edit CAS" }} />
      <Stack.Screen name="cas/[casId]/session/new" options={{ title: "New session" }} />
      <Stack.Screen
        name="cas/[casId]/session/[sessionId]"
        options={{ title: "Session" }}
      />
    </Stack>
  );
}
