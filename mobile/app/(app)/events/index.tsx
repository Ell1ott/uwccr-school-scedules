import {
  EVENT_FILTERS,
  formatEventListTime,
  groupEventsByDay,
  isSchoolEventPast,
  matchesEventFilter,
  rsvpLabel,
  type EventFilterId,
  type SchoolEvent,
} from "@shared/lib/schoolEvents";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { Body, Chip, Eyebrow, Screen, Title } from "@/src/ui";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { CasGroup } from "@shared/lib/cas";

const POSTERS = [
  { bg: "#141414", fg: "#f4efe4", accent: "#d4a574" },
  { bg: "#162016", fg: "#e7f0d8", accent: "#8fbc5a" },
  { bg: "#1c1410", fg: "#f3e6d0", accent: "#e07a4c" },
  { bg: "#101820", fg: "#dce8f0", accent: "#6eb0d4" },
  { bg: "#1a1610", fg: "#f5e6c8", accent: "#e8c547" },
  { bg: "#201414", fg: "#f4e0d8", accent: "#d46a5c" },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function EventsScreen() {
  const auth = useAuth();
  const catalog = useCatalog();
  const [filter, setFilter] = useState<EventFilterId>("all");
  const [casMode, setCasMode] = useState<"mine" | "discover">("mine");

  const mine = catalog.casGroups.filter(
    (group) => group.iAmMember || group.createdBy === auth.profileId,
  );
  const discover = catalog.casGroups.filter(
    (group) =>
      group.status === "published" &&
      !group.iAmMember &&
      group.createdBy !== auth.profileId,
  );
  const casShown = casMode === "mine" ? mine : discover;

  const filtered = useMemo(
    () => catalog.schoolEvents.filter((event) => matchesEventFilter(event, filter)),
    [catalog.schoolEvents, filter],
  );
  const upcoming = filtered.filter((event) => !isSchoolEventPast(event));
  const groups = groupEventsByDay(upcoming);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-2">
          <View className="flex-row items-start justify-between">
            <View>
              <Eyebrow>After classes</Eyebrow>
              <Title>Events</Title>
            </View>
            <Pressable
              className="mt-2 rounded-full bg-primary px-3 py-2"
              onPress={() => router.push("/(app)/events/new")}
            >
              <Text className="font-medium text-on-primary">New</Text>
            </Pressable>
          </View>
          <View className="mt-6 flex-row items-center justify-between">
            <Text className="font-bold text-[22px] text-on-surface">CAS</Text>
            <View className="flex-row">
              <Chip
                label="Mine"
                selected={casMode === "mine"}
                onPress={() => setCasMode("mine")}
              />
              <Chip
                label="Discover"
                selected={casMode === "discover"}
                onPress={() => setCasMode("discover")}
              />
            </View>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}
        >
          {casShown.map((group) => (
            <CasTile key={group.id} group={group} />
          ))}
          <Pressable
            onPress={() => router.push("/(app)/events/cas/new")}
            className="h-44 w-36 items-center justify-center rounded-[18px] bg-surface-container"
          >
            <Text className="font-medium text-on-surface">New CAS</Text>
          </Pressable>
        </ScrollView>
        <View className="mt-8 px-4">
          <Text className="mb-3 font-bold text-[22px] text-on-surface">Gatherings</Text>
          <View className="flex-row flex-wrap">
            {EVENT_FILTERS.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={filter === item.id}
                onPress={() => setFilter(item.id)}
              />
            ))}
          </View>
          {groups.length === 0 ? (
            <Body muted>Nothing on the books in this filter.</Body>
          ) : (
            groups.map((group) => (
              <View key={group.date} className="mt-5">
                <Text className="font-medium text-[13px] uppercase tracking-[1.5px] text-on-surface-variant">
                  {group.weekdayLabel} {group.dateLabel}
                </Text>
                {group.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function CasTile({ group }: { group: CasGroup }) {
  const palette = POSTERS[hashString(group.id + group.title) % POSTERS.length];
  return (
    <Pressable
      onPress={() => router.push(`/(app)/events/cas/${group.id}`)}
      className="mr-3 h-44 w-40 justify-between rounded-[18px] p-4"
      style={{ backgroundColor: palette.bg }}
    >
      <View
        className="absolute right-[-10] top-[-10] h-16 w-16 rounded-full"
        style={{ backgroundColor: palette.accent, opacity: 0.35 }}
      />
      <Text className="font-bold text-[22px] leading-6" style={{ color: palette.fg }}>
        {group.title}
      </Text>
      <Text className="font-sans text-[12px]" style={{ color: palette.fg, opacity: 0.8 }}>
        {group.memberCount} members
        {group.nextSession ? " · next session" : ""}
      </Text>
    </Pressable>
  );
}

function EventRow({ event }: { event: SchoolEvent }) {
  return (
    <Pressable
      onPress={() => router.push(`/(app)/events/${event.id}`)}
      className="mt-2 rounded-[16px] px-4 py-3"
      style={{ backgroundColor: "#f4f4f4" }}
    >
      <Text className="font-medium text-[12px] text-on-surface-variant">
        {formatEventListTime(event)}
      </Text>
      <Text className="font-semibold text-[20px] text-on-surface">{event.title}</Text>
      <Text className="font-sans text-[13px] text-on-surface-variant">
        {[event.location || null, rsvpLabel(event)].filter(Boolean).join(" · ")}
      </Text>
    </Pressable>
  );
}
