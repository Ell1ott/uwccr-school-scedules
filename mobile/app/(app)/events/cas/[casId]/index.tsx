import {
  archiveCas,
  formatCasWhen,
  groupCasSessionsByDay,
  isCasSessionPast,
  joinCas,
  leaveCas,
  type CasSession,
} from "@shared/lib/cas";
import { useLocalSearchParams, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { Body, Button, Screen, Scroll, Title } from "@/src/ui";

export default function CasDetailScreen() {
  const { casId } = useLocalSearchParams<{ casId: string }>();
  const auth = useAuth();
  const catalog = useCatalog();
  const group = catalog.casGroups.find((item) => item.id === casId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upcoming = useMemo(
    () => (group ? group.sessions.filter((session) => !isCasSessionPast(session)) : []),
    [group],
  );
  const days = groupCasSessionsByDay(upcoming);

  if (!group) {
    return (
      <Screen>
        <Body muted>CAS group not found.</Body>
      </Screen>
    );
  }

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Screen>
      <Scroll>
        <Title>{group.title}</Title>
        <Body muted>
          {[group.location, `${group.memberCount} members`, group.status].filter(Boolean).join(" · ")}
        </Body>
        {group.description ? (
          <Text className="mt-4 font-sans text-on-surface">{group.description}</Text>
        ) : null}
        <View className="mt-6 gap-3">
          {!group.iAmMember ? (
            <Button label="Join" onPress={() => void run(() => joinCas(group.id))} busy={busy} />
          ) : (
            <Button
              label="Leave"
              tone="ghost"
              onPress={() => void run(() => leaveCas(group.id))}
            />
          )}
          {group.iAmLeader || group.createdBy === auth.profileId ? (
            <>
              <Button
                label="Edit CAS"
                tone="ghost"
                onPress={() => router.push(`/(app)/events/cas/${group.id}/edit`)}
              />
              <Button
                label="Add session"
                onPress={() => router.push(`/(app)/events/cas/${group.id}/session/new`)}
              />
              <Button
                label="Archive"
                tone="danger"
                onPress={() => void run(() => archiveCas(group.id))}
              />
            </>
          ) : null}
        </View>
        {days.map((day) => (
          <View key={day.date} className="mt-6">
            <Text className="font-medium text-on-surface-variant">{day.dateLabel}</Text>
            {day.sessions.map((session) => (
              <SessionRow key={session.id} session={session} casId={group.id} />
            ))}
          </View>
        ))}
        {error ? <Text className="mt-4 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}

function SessionRow({ session, casId }: { session: CasSession; casId: string }) {
  return (
    <Pressable
      className="mt-2 rounded-[16px] bg-[#f4f4f4] px-4 py-3"
      onPress={() =>
        router.push(`/(app)/events/cas/${casId}/session/${session.id}`)
      }
    >
      <Text className="font-medium text-[12px] text-on-surface-variant">{formatCasWhen(session)}</Text>
      <Text className="font-semibold text-[20px] text-on-surface">{session.title}</Text>
      <Text className="font-sans text-[13px] text-on-surface-variant">
        {session.location || session.mode}
      </Text>
    </Pressable>
  );
}
