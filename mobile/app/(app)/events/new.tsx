import { useCatalog } from "@/src/catalog";
import { EventEditor } from "@/src/forms/EventEditor";
import { Screen } from "@/src/ui";

export default function NewEventScreen() {
  const { students } = useCatalog();
  return (
    <Screen>
      <EventEditor students={students} />
    </Screen>
  );
}
