import { Redirect } from "expo-router";
import { useAuth } from "@/src/lib/auth";

export default function Index() {
  const auth = useAuth();
  if (auth.loading) return null;
  if (!auth.session) return <Redirect href="/login" />;
  if (!auth.role) return <Redirect href="/no-profile" />;
  return <Redirect href="/(app)/schedule" />;
}
