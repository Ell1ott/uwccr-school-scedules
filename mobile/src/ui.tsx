import { colors } from "./theme";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

export function Screen({
  children,
  padded = true,
  bg = "surface-dim",
}: {
  children: ReactNode;
  padded?: boolean;
  bg?: "surface-dim" | "surface" | "reach";
}) {
  const background =
    bg === "reach" ? "bg-reach-bg" : bg === "surface" ? "bg-surface" : "bg-surface-dim";
  return (
    <SafeAreaView className={`flex-1 ${background}`} edges={["top", "left", "right"]}>
      <View className={`flex-1 ${padded ? "px-4" : ""}`}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text className="font-bold text-[24px] leading-8 tracking-[-0.24px] text-on-surface">
      {children}
    </Text>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-1 font-medium text-[12px] uppercase tracking-[2.24px] text-on-surface-variant">
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Text
      className={`font-sans text-[16px] leading-6 ${
        muted ? "text-on-surface-variant" : "text-on-surface"
      }`}
    >
      {children}
    </Text>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-medium text-[13px] text-on-surface-variant">{label}</Text>
      <TextInput
        placeholderTextColor={colors.onSurfaceVariant}
        className="h-12 rounded-2xl bg-surface-container px-4 font-sans text-[16px] text-on-surface"
        {...props}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary"
      : tone === "danger"
        ? "bg-error"
        : "bg-surface-container";
  const labelClass = tone === "ghost" ? "text-on-surface" : "text-on-primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className={`h-12 items-center justify-center rounded-full px-5 ${toneClass} ${
        disabled ? "opacity-50" : "active:opacity-90"
      }`}
    >
      {busy ? (
        <ActivityIndicator color={tone === "ghost" ? colors.onSurface : colors.onPrimary} />
      ) : (
        <Text className={`font-medium text-[12px] tracking-wide ${labelClass}`}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full px-3 py-1.5 ${
        selected ? "bg-primary" : "bg-surface-container"
      }`}
    >
      <Text
        className={`font-medium text-[13px] ${selected ? "text-on-primary" : "text-on-surface"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  ...props
}: ViewProps & { children: ReactNode }) {
  return (
    <View
      className="rounded-[18px] bg-surface-container-lowest p-4"
      style={[
        { shadowColor: "#041627", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function Empty({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View className="items-center px-6 py-12">
      <Text className="font-bold text-[24px] text-on-surface">{title}</Text>
      <Text className="mt-2 text-center font-sans text-[15px] leading-6 text-on-surface-variant">
        {body}
      </Text>
    </View>
  );
}

export function Scroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
