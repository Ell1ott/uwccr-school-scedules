import { Stack, router } from "expo-router";
import { Pressable, Text } from "react-native";
import { SymbolView } from "expo-symbols";
import { reach } from "@/src/theme";

export default function ReachStack() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: reach.bg },
        headerTintColor: reach.blue,
        headerTitleStyle: { fontWeight: "600", fontSize: 17 },
        headerLargeTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: reach.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Reach",
          headerLargeTitle: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(app)/reach/new")}
              hitSlop={12}
              accessibilityLabel="New leave"
            >
              <SymbolView
                name={{ ios: "plus", android: "add", web: "add" }}
                size={22}
                tintColor={reach.blue}
                fallback={<Text style={{ color: reach.blue, fontSize: 28, lineHeight: 28 }}>+</Text>}
              />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="new" options={{ title: "New leave" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit leave" }} />
    </Stack>
  );
}
