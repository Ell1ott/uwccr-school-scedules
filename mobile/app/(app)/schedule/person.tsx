import { searchPeople } from "@shared/lib/people";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { Chip, Field, Screen, Scroll } from "@/src/ui";

export default function PersonScreen() {
  const auth = useAuth();
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"student" | "teacher">("student");

  const students = useMemo(
    () => searchPeople(catalog.students, query).slice(0, 40),
    [catalog.students, query],
  );
  const teachers = useMemo(
    () => searchPeople(catalog.teachers, query).slice(0, 40),
    [catalog.teachers, query],
  );

  function pick(next: { kind: "student" | "teacher"; id: string }) {
    catalog.choosePerson(next);
    router.back();
  }

  return (
    <Screen>
      <Scroll>
        <View className="mt-2 flex-row">
          <Chip label="Students" selected={kind === "student"} onPress={() => setKind("student")} />
          <Chip label="Teachers" selected={kind === "teacher"} onPress={() => setKind("teacher")} />
        </View>
        {auth.studentId ? (
          <Pressable
            className="mb-3 rounded-2xl bg-primary px-4 py-3"
            onPress={() => pick({ kind: "student", id: auth.studentId! })}
          >
            <Text className="font-medium text-on-primary">Back to my schedule</Text>
          </Pressable>
        ) : null}
        {auth.teacherId ? (
          <Pressable
            className="mb-3 rounded-2xl bg-primary px-4 py-3"
            onPress={() => pick({ kind: "teacher", id: auth.teacherId! })}
          >
            <Text className="font-medium text-on-primary">Back to my classes</Text>
          </Pressable>
        ) : null}
        <Field label="Search" value={query} onChangeText={setQuery} autoFocus />
        {(kind === "student" ? students : teachers).map((person) => (
          <Pressable
            key={person.id}
            className="border-b border-outline-variant py-3"
            onPress={() => pick({ kind, id: person.id })}
          >
            <Text className="font-semibold text-[18px] text-on-surface">{person.name}</Text>
            {"cohort" in person ? (
              <Text className="font-sans text-[13px] text-on-surface-variant">{person.cohort}</Text>
            ) : null}
          </Pressable>
        ))}
      </Scroll>
    </Screen>
  );
}
