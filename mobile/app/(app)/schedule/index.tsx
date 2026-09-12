import { DAYS } from "@shared/data/weekTemplate";
import { formatTime, todayDayId } from "@shared/lib/buildSchedule";
import { formatDayDate, mondayOf } from "@shared/lib/calendar";
import { minutesOfDay, useNow } from "@shared/lib/now";
import { formatCohorts } from "@shared/lib/teachers";
import { isBandKind, toneForEvent } from "@shared/lib/tones";
import type { DayId, ScheduleEvent } from "@shared/types";
import { router } from "expo-router";
import { Settings2 } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCatalog } from "@/src/catalog";
import { EventIcon, LessonMark } from "@/src/lib/icons";
import { colors, toneColors } from "@/src/theme";
import { Eyebrow } from "@/src/ui";

export default function ScheduleScreen() {
  const catalog = useCatalog();
  const insets = useSafeAreaInsets();
  const personName =
    catalog.student?.name ?? catalog.teacher?.name ?? "Pick someone";
  const events = catalog.week?.[catalog.dayId] ?? [];
  const now = useNow();
  const thisWeek = mondayOf(now);
  const todayId = todayDayId(now);

  function openEvent(event: ScheduleEvent) {
    if (event.kind === "school_event" && event.schoolEventId) {
      router.push(`/(app)/events/${event.schoolEventId}`);
      return;
    }
    if (event.kind === "cas" && event.casId && event.casSessionId) {
      router.push(
        `/(app)/events/cas/${event.casId}/session/${event.casSessionId}`,
      );
      return;
    }
    catalog.setOpenClass(event);
    router.push("/(app)/schedule/class");
  }

  return (
    <View className="flex-1 bg-surface-container-lowest">
      <View
        className="z-40 overflow-hidden"
        style={{
          paddingTop: insets.top + 16,
          shadowColor: "#000",
          shadowOpacity: 0.02,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View className="bg-surface-container-lowest/80 px-4 pb-4">
          <View className="mb-3 flex-row items-start justify-between">
            <Pressable onPress={() => router.push("/(app)/schedule/person")}>
              <Eyebrow>{catalog.viewingOtherName ? "Viewing" : "Your week"}</Eyebrow>
              <Text className="font-bold text-[24px] leading-8 tracking-[-0.24px] text-on-surface">
                {personName}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/schedule/settings")}
              className="mt-1 size-9 items-center justify-center rounded-full bg-surface-container"
              accessibilityLabel="Settings"
            >
              <Settings2 color={colors.onSurface} size={16} strokeWidth={1.75} />
            </Pressable>
          </View>
          <View className="flex-row">
            {DAYS.map((day) => {
              const selected = day.id === catalog.dayId;
              return (
                <Text
                  key={day.id}
                  className={`flex-1 text-center font-medium text-[11px] tracking-[1.3px] ${
                    selected ? "text-on-surface" : "text-on-surface-variant/70"
                  }`}
                >
                  {day.short}
                </Text>
              );
            })}
          </View>
          <View className="mt-1 flex-row">
            {DAYS.map((day) => {
              const selected = day.id === catalog.dayId;
              const isToday = catalog.weekStart === thisWeek && todayId === day.id;
              return (
                <Pressable
                  key={day.id}
                  className="flex-1 items-center py-0.5"
                  onPress={() => catalog.setDayId(day.id as DayId)}
                >
                  <View
                    className={`size-9 items-center justify-center rounded-full ${
                      selected
                        ? "bg-primary"
                        : isToday
                          ? "border border-primary/30"
                          : ""
                    }`}
                  >
                    <Text
                      className={`font-semibold text-[15px] tabular-nums ${
                        selected
                          ? "text-on-primary"
                          : isToday
                            ? "text-primary"
                            : "text-on-surface-variant"
                      }`}
                    >
                      {formatDayDate(catalog.weekStart, day.id)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Pressable onPress={() => catalog.shiftCurrentWeek(-1)}>
              <Text className="font-medium text-[13px] text-on-surface-variant">Last week</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/schedule/try-classes")}>
              <Text className="font-medium text-[13px] text-primary">Try classes</Text>
            </Pressable>
            <Pressable onPress={() => catalog.shiftCurrentWeek(1)}>
              <Text className="font-medium text-[13px] text-on-surface-variant">Next week</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 96, paddingTop: 8 }}>
        <DayEvents
          dayId={catalog.dayId}
          weekStart={catalog.weekStart}
          events={events}
          onOpen={openEvent}
        />
      </ScrollView>
    </View>
  );
}

function DayEvents({
  dayId,
  weekStart,
  events,
  onOpen,
}: {
  dayId: DayId;
  weekStart: string;
  events: ScheduleEvent[];
  onOpen: (event: ScheduleEvent) => void;
}) {
  const allDayEvents = events.filter((event) => event.allDay);
  const timedEvents = events.filter((event) => !event.allDay);
  const [slots, setSlots] = useState<Record<string, { top: number; height: number }>>({});
  const now = useNow();
  const lineY = useMemo(
    () => nowLineOffset(timedEvents, slots, minutesOfDay(now), dayId, weekStart, now),
    [timedEvents, slots, now, dayId, weekStart],
  );

  return (
    <View className="relative px-4">
      {allDayEvents.length > 0 ? (
        <View className="mb-3 gap-1.5">
          {allDayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              dayId={dayId}
              weekStart={weekStart}
              compact
              onOpen={onOpen}
            />
          ))}
        </View>
      ) : null}
      <View className="gap-3">
        {timedEvents.map((event) => (
          <View
            key={event.id}
            className={`flex-row gap-3 ${event.kind === "study" ? "items-center" : ""}`}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              setSlots((prev) =>
                prev[event.id]?.top === y && prev[event.id]?.height === height
                  ? prev
                  : { ...prev, [event.id]: { top: y, height } },
              );
            }}
          >
            <View className={`w-[72px] shrink-0 items-end ${event.kind === "study" ? "" : "pt-4"}`}>
              <Text className="font-semibold text-[14px] leading-5 text-on-surface-variant">
                {formatTime(event.start)}
              </Text>
              <Text className="mt-0.5 font-medium text-[11px] leading-4 text-on-surface-variant/45">
                {formatTime(event.end)}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <EventCard
                event={event}
                dayId={dayId}
                weekStart={weekStart}
                onOpen={onOpen}
              />
            </View>
          </View>
        ))}
      </View>
      {lineY != null ? (
        <View
          pointerEvents="none"
          className="absolute inset-x-4 z-20 flex-row items-center gap-3"
          style={{ top: lineY - 4 }}
        >
          <View className="w-[72px]" />
          <View className="relative min-w-0 flex-1">
            <View className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
            <View className="h-[2px] w-full bg-primary/30" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function nowLineOffset(
  events: ScheduleEvent[],
  slots: Record<string, { top: number; height: number }>,
  nowMin: number,
  dayId: DayId,
  weekStart: string,
  now: Date,
) {
  if (mondayOf(now) !== weekStart || todayDayId(now) !== dayId) return null;
  const measured = events
    .map((event) => {
      const slot = slots[event.id];
      if (!slot) return null;
      return {
        startMin: event.startMin,
        endMin: event.endMin,
        top: slot.top,
        bottom: slot.top + slot.height,
      };
    })
    .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
  const first = measured[0];
  const last = measured[measured.length - 1];
  if (!first || nowMin < first.startMin || nowMin > last.endMin) return null;
  for (let i = 0; i < measured.length; i += 1) {
    const slot = measured[i];
    const next = measured[i + 1];
    if (nowMin <= slot.endMin) {
      const duration = slot.endMin - slot.startMin;
      const t = duration <= 0 ? 0 : (nowMin - slot.startMin) / duration;
      return slot.top + (slot.bottom - slot.top) * Math.min(1, Math.max(0, t));
    }
    if (next && nowMin < next.startMin) {
      const duration = next.startMin - slot.endMin;
      const t = duration <= 0 ? 1 : (nowMin - slot.endMin) / duration;
      return slot.bottom + (next.top - slot.bottom) * Math.min(1, Math.max(0, t));
    }
  }
  return last.bottom;
}

function EventCard({
  event,
  dayId,
  weekStart,
  compact,
  onOpen,
}: {
  event: ScheduleEvent;
  dayId: DayId;
  weekStart: string;
  compact?: boolean;
  onOpen: (event: ScheduleEvent) => void;
}) {
  const catalog = useCatalog();
  const tone = toneColors(toneForEvent(event, catalog.palette));
  const interactive =
    event.kind === "class" || event.kind === "school_event" || event.kind === "cas";

  if (event.allDay) {
    return (
      <Pressable
        disabled={!interactive}
        onPress={() => onOpen(event)}
        className={`h-8 flex-row items-center gap-1.5 overflow-hidden rounded-lg px-2.5 ${
          event.cancelled ? "opacity-70" : ""
        }`}
        style={{ backgroundColor: tone.bg }}
      >
        {event.kind === "school_event" ? (
          <EventIcon name="sparkles" size={14} color="#000" />
        ) : event.kind === "cas" ? (
          <EventIcon name="users" size={14} color="#000" />
        ) : event.icon ? (
          <EventIcon name={event.icon} size={14} color="#000" />
        ) : null}
        <Text
          numberOfLines={1}
          className={`flex-1 font-semibold text-[13px] ${event.cancelled ? "line-through" : ""}`}
          style={{ color: tone.text }}
        >
          {event.title}
        </Text>
      </Pressable>
    );
  }

  if (isBandKind(event.kind)) {
    return (
      <View className="items-center justify-center rounded-lg bg-surface-container py-2.5">
        <Text className="font-medium text-[12px] uppercase tracking-[2.4px] text-black">
          {event.title}
        </Text>
      </View>
    );
  }

  if (event.kind === "study") {
    return (
      <Pressable
        onPress={() => onOpen(event)}
        className="min-h-[48px] items-center justify-center active:scale-[0.99]"
      >
        <Text className="font-medium text-[13px] tracking-wide text-black/45">{event.title}</Text>
        {event.block ? (
          <Text className="mt-1 rounded-full bg-black/5 px-2 py-px font-medium text-[10px] text-black/50">
            {event.block}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  const chipLabel = event.cancelled
    ? "Cancelled"
    : event.extras && event.extras.length > 0
      ? "Conflict"
      : event.level && event.level !== event.title
        ? event.block
          ? `${event.level} · ${event.block}`
          : event.level
        : event.block
          ? `Block ${event.block}`
          : event.cohorts && event.cohorts.length === 1
            ? event.cohorts[0]
            : null;

  return (
    <Pressable
      disabled={!interactive}
      onPress={() => onOpen(event)}
      className={`overflow-hidden rounded-[10px] px-3 py-2.5 active:scale-[0.99] ${
        event.cancelled ? "opacity-70" : ""
      }`}
      style={{
        backgroundColor: tone.bg,
        shadowColor: "#041627",
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View className="mb-1.5 flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-start gap-1.5">
          {event.kind === "class" ? (
            <View className="mt-0.5">
              <LessonMark subject={event.title} size={16} color="#000" />
            </View>
          ) : event.kind === "school_event" ? (
            <View className="mt-0.5">
              <EventIcon name="sparkles" size={16} color="#000" />
            </View>
          ) : event.kind === "cas" ? (
            <View className="mt-0.5">
              <EventIcon name="users" size={16} color="#000" />
            </View>
          ) : null}
          <Text
            className={`min-w-0 flex-1 font-semibold text-[15px] leading-5 ${
              event.cancelled ? "line-through" : ""
            }`}
            style={{ color: tone.text }}
          >
            {event.title}
          </Text>
        </View>
        {event.note || chipLabel ? (
          <View className="flex-row items-start gap-1">
            {event.note ? (
              <View className="flex-row items-center rounded-full bg-inverse-surface px-1.5 py-px">
                <EventIcon name="sticky-note" size={10} color={colors.inverseOnSurface} />
                <Text className="ml-0.5 font-medium text-[10px] tracking-wide text-inverse-on-surface">
                  Note
                </Text>
              </View>
            ) : null}
            {chipLabel ? (
              <View
                className={`rounded-full px-1.5 py-px ${
                  event.cancelled || event.extras ? "bg-error-container" : "bg-black/10"
                }`}
              >
                <Text className="font-medium text-[10px] tracking-wide text-black">{chipLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View className="gap-0.5">
        {event.studentCount != null ? (
          <Meta>
            {event.studentCount} {event.studentCount === 1 ? "student" : "students"}
            {event.cohorts && event.cohorts.length > 0 ? ` · ${formatCohorts(event.cohorts)}` : ""}
          </Meta>
        ) : event.teacher ? (
          <Meta>{event.teacher}</Meta>
        ) : null}
        {event.room ? <Meta>{event.kind === "class" ? `Rm ${event.room}` : event.room}</Meta> : null}
        {!compact && event.subtitle && event.studentCount == null && !event.teacher ? (
          <Meta>{event.subtitle}</Meta>
        ) : null}
      </View>
    </Pressable>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <Text className="text-[12px] leading-4 text-black/70">{children}</Text>;
}
