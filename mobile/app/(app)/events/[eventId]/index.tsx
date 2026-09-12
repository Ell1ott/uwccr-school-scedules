import { initials } from "@shared/lib/classDetail";
import { findById } from "@shared/lib/people";
import {
  cancelSchoolEvent,
  fetchEventResponses,
  formatEventWhen,
  joinSchoolEvent,
  leaveSchoolEvent,
  respondToInvite,
  rsvpLabel,
  type EventResponseRow,
} from "@shared/lib/schoolEvents";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { Body, Button, Screen, Scroll, Title } from "@/src/ui";

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const auth = useAuth();
  const catalog = useCatalog();
  const event = catalog.schoolEvents.find((item) => item.id === eventId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<EventResponseRow[]>([]);

  useEffect(() => {
    if (!event) return;
    void fetchEventResponses(event.id).then(setResponses);
  }, [event]);

  if (!event) {
    return (
      <Screen>
        <Body muted>That event is gone or still loading.</Body>
      </Screen>
    );
  }

  const mine = auth.profileId === event.createdBy;
  const canEdit = mine && (auth.role === "staff" || event.status === "pending");

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Screen>
      <Scroll>
        <Text className="font-medium text-on-surface-variant">{formatEventWhen(event)}</Text>
        <Title>{event.title}</Title>
        <Body muted>{[event.location, event.hostName, rsvpLabel(event)].filter(Boolean).join(" · ")}</Body>
        {event.description ? <Text className="mt-4 font-sans text-on-surface">{event.description}</Text> : null}
        <View className="mt-6 gap-3">
          {event.mode === "invite" && event.myStatus === "pending" ? (
            <>
              <Button
                label="I'm going"
                onPress={() => void run(() => respondToInvite(event.id, "going"))}
                busy={busy}
              />
              <Button
                label="Decline"
                tone="ghost"
                onPress={() => void run(() => respondToInvite(event.id, "declined"))}
              />
            </>
          ) : null}
          {(event.mode === "open" || event.mode === "invite") &&
          event.myStatus !== "going" &&
          event.myStatus !== "pending" ? (
            <Button
              label="Join"
              onPress={() =>
                void run(async () => {
                  const result = await joinSchoolEvent(event.id);
                  return result.error;
                })
              }
              busy={busy}
            />
          ) : null}
          {event.myStatus === "going" || event.myStatus === "waitlisted" ? (
            <Button
              label="Leave"
              tone="ghost"
              onPress={() => void run(() => leaveSchoolEvent(event.id))}
            />
          ) : null}
          {canEdit ? (
            <Button
              label="Edit"
              tone="ghost"
              onPress={() => router.push(`/(app)/events/${event.id}/edit`)}
            />
          ) : null}
          {mine && event.status !== "cancelled" ? (
            <Button
              label="Cancel event"
              tone="danger"
              onPress={() => void run(() => cancelSchoolEvent(event.id, false))}
            />
          ) : null}
        </View>
        {responses.length ? (
          <View className="mt-8">
            <Text className="mb-2 font-medium text-on-surface-variant">Responses</Text>
            {responses.map((row) => (
              <View key={`${row.eventId}-${row.studentId}`} className="flex-row justify-between py-1">
                <Text className="font-sans text-on-surface">
                  {findById(catalog.students, row.studentId)?.name ?? initials(row.studentId)}
                </Text>
                <Text className="font-sans text-on-surface-variant">{row.status}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {error ? <Text className="mt-4 text-error">{error}</Text> : null}
      </Scroll>
    </Screen>
  );
}
