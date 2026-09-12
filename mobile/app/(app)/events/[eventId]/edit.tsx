import { useLocalSearchParams } from "expo-router";
import { useCatalog } from "@/src/catalog";
import { EventEditor } from "@/src/forms/EventEditor";
import { Body, Screen } from "@/src/ui";

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { students, schoolEvents } = useCatalog();
  const editing = schoolEvents.find((event) => event.id === eventId);
  if (!editing) {
    return (
      <Screen>
        <Body muted>Event not found.</Body>
      </Screen>
    );
  }
  return (
    <Screen>
      <EventEditor students={students} editing={editing} />
    </Screen>
  );
}
