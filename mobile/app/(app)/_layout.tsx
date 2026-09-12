import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "@/src/theme";

export const unstable_settings = {
  initialRouteName: "schedule",
};

export default function AppTabs() {
  return (
    <NativeTabs
      tintColor={colors.primary}
      iconColor={colors.onSurfaceVariant}
      labelStyle={{ fontSize: 11, fontWeight: "600" }}
    >
      <NativeTabs.Trigger name="schedule">
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reach">
        <NativeTabs.Trigger.Label>Reach</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="door.left.hand.open" md="door_front" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
