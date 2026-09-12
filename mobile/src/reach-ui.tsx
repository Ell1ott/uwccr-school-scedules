import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { SymbolView } from "expo-symbols";
import { reach } from "./theme";

export function ReachPage({ children }: { children: ReactNode }) {
  return <View className="flex-1 bg-reach-bg">{children}</View>;
}

export function ReachLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: reach.muted,
        fontSize: 13,
        marginLeft: 16,
        marginBottom: 7,
      }}
    >
      {children}
    </Text>
  );
}

export function ReachGroup({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: reach.card,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

export function ReachRow({
  children,
  onPress,
  last,
}: {
  children: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderTopWidth: last ? 0 : undefined,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: reach.line,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
        {body}
      </Pressable>
    );
  }
  return body;
}

export function ReachTag({
  label,
  tone,
}: {
  label: string;
  tone: "auto" | "rc" | "docs" | "ok" | "wait" | "bad";
}) {
  const palette =
    tone === "auto" || tone === "ok"
      ? { bg: reach.okFill, fg: reach.okInk }
      : tone === "rc" || tone === "wait"
        ? { bg: reach.waitFill, fg: reach.waitInk }
        : { bg: reach.badFill, fg: reach.badInk };
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function ReachSymbol({
  name,
  size = 18,
  color = reach.muted,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <SymbolView
      name={{ ios: name as never, android: "chevron_right", web: "chevron_right" }}
      size={size}
      tintColor={color}
      fallback={<Text style={{ color, fontSize: size - 2 }}>{name === "plus" ? "+" : "›"}</Text>}
    />
  );
}

export function ReachButton({
  label,
  onPress,
  tone = "yes",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "yes" | "no" | "danger" | "cta";
  disabled?: boolean;
}) {
  const bg =
    tone === "cta" || tone === "yes"
      ? reach.blue
      : tone === "danger"
        ? "#ffe5e3"
        : reach.fill;
  const fg = tone === "danger" ? reach.red : tone === "no" ? reach.ink : "#ffffff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        height: tone === "cta" ? 50 : 40,
        borderRadius: tone === "cta" ? 12 : 10,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: fg, fontSize: tone === "cta" ? 17 : 16, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ReachField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
      <Text style={{ color: reach.muted, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor={reach.muted}
        style={{
          minHeight: 44,
          borderRadius: 8,
          backgroundColor: reach.bg,
          paddingHorizontal: 12,
          fontSize: 17,
          color: reach.ink,
        }}
        {...props}
      />
    </View>
  );
}
