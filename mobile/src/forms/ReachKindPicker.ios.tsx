import { REACH_LEAVE_TYPES, type ReachLeaveType } from "@shared/lib/reach";
import { Button, Form, Host, Section } from "@expo/ui/swift-ui";

export function ReachKindPicker({
  onPick,
}: {
  onPick: (type: ReachLeaveType) => void;
}) {
  const single = REACH_LEAVE_TYPES.filter((type) => type.group === "quick");
  const multi = REACH_LEAVE_TYPES.filter((type) => type.group === "ask");
  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title="Single day">
          {single.map((type) => (
            <Button
              key={type.id}
              label={`${type.label} · ${type.stamp}`}
              systemImage="chevron.right"
              onPress={() => onPick(type.id)}
            />
          ))}
        </Section>
        <Section title="Multiple days">
          {multi.map((type) => (
            <Button
              key={type.id}
              label={`${type.label} · ${type.stamp}`}
              systemImage="chevron.right"
              onPress={() => onPick(type.id)}
            />
          ))}
        </Section>
      </Form>
    </Host>
  );
}
