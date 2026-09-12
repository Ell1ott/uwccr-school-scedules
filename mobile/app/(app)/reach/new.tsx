import { useCatalog } from "@/src/catalog";
import { ReachEditor } from "@/src/forms/ReachEditor";

export default function NewReachScreen() {
  const { students } = useCatalog();
  return <ReachEditor students={students} />;
}
