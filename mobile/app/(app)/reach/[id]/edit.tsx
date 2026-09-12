import {
  canManageReachRequest,
  reachRequestLocked,
  useReachCatalog,
} from "@shared/lib/reach";
import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { ReachEditor } from "@/src/forms/ReachEditor";
import { ReachPage } from "@/src/reach-ui";
import { reach } from "@/src/theme";

export default function EditReachScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const { students } = useCatalog();
  const { requests } = useReachCatalog(Boolean(auth.session && auth.role));
  const editing = requests.find((request) => request.id === id);
  if (!editing) {
    return (
      <ReachPage>
        <Text style={{ color: reach.muted, padding: 16, fontSize: 15 }}>
          Leave request not found.
        </Text>
      </ReachPage>
    );
  }
  if (!canManageReachRequest(editing, auth)) {
    return (
      <ReachPage>
        <Text style={{ color: reach.muted, padding: 16, fontSize: 15 }}>
          {reachRequestLocked(editing.status)
            ? "This leave cannot be changed after sign-out."
            : "Only the student who created this leave can change it."}
        </Text>
      </ReachPage>
    );
  }
  return <ReachEditor students={students} editing={editing} />;
}
