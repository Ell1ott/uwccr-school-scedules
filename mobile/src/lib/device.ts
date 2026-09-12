import { Platform } from "react-native";

export function isIos() {
  return Platform.OS === "ios";
}

export function isStandalone() {
  return true;
}
