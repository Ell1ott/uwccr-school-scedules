import { REACH_LEAVE_TYPES, type ReachLeaveType } from "@shared/lib/reach";
import { Text, View } from "react-native";
import { ReachGroup, ReachLabel, ReachRow, ReachSymbol, ReachTag } from "@/src/reach-ui";
import { reach } from "@/src/theme";

export function ReachKindPicker({
  onPick,
}: {
  onPick: (type: ReachLeaveType) => void;
}) {
  const single = REACH_LEAVE_TYPES.filter((type) => type.group === "quick");
  const multi = REACH_LEAVE_TYPES.filter((type) => type.group === "ask");
  return (
    <View style={{ gap: 20, paddingHorizontal: 16, paddingTop: 8 }}>
      <Text style={{ color: reach.ink, fontSize: 28, fontWeight: "700", letterSpacing: -0.8 }}>
        What kind of leave?
      </Text>
      <TypeSection title="Single day" types={single} onPick={onPick} />
      <TypeSection title="Multiple days" types={multi} onPick={onPick} />
    </View>
  );
}

function TypeSection({
  title,
  types,
  onPick,
}: {
  title: string;
  types: typeof REACH_LEAVE_TYPES;
  onPick: (type: ReachLeaveType) => void;
}) {
  return (
    <View>
      <ReachLabel>{title}</ReachLabel>
      <ReachGroup>
        {types.map((type, index) => (
          <ReachRow
            key={type.id}
            last={index === types.length - 1}
            onPress={() => onPick(type.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: reach.ink, fontSize: 17, fontWeight: "600" }}>
                {type.label}
              </Text>
              <Text style={{ color: reach.muted, fontSize: 13, marginTop: 2 }}>{type.window}</Text>
            </View>
            <ReachTag
              label={type.stamp}
              tone={type.stamp === "Auto" ? "auto" : type.stamp === "RC" ? "rc" : "docs"}
            />
            <View style={{ marginLeft: 8 }}>
              <ReachSymbol name="chevron.right" />
            </View>
          </ReachRow>
        ))}
      </ReachGroup>
    </View>
  );
}
