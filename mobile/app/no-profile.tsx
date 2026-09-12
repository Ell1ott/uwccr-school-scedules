import { View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { Body, Button, Eyebrow, Screen, Title } from "@/src/ui";

export default function NoProfileScreen() {
  const auth = useAuth();
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Eyebrow>Account</Eyebrow>
        <Title>No school profile yet</Title>
        <Body muted>
          This Google account signed in, but it is not linked to a student or
          teacher profile. Ask a staff member to provision it on the website.
        </Body>
        <View className="mt-8">
          <Button label="Sign out" tone="ghost" onPress={() => void auth.signOut()} />
        </View>
      </View>
    </Screen>
  );
}
