import { Stack } from "expo-router";
import { colors } from "@/src/theme";

export default function ScheduleStack() {
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
      <Stack.Screen name="person" options={{ title: "View someone" }} />
      <Stack.Screen
        name="class"
        options={{ title: "Class", presentation: "modal" }}
      />
      <Stack.Screen name="try-classes" options={{ title: "Try classes" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
