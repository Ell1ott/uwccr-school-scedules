import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { createSessionFromUrl } from "@/src/lib/auth";

export default function AuthCallback() {
  const url = Linking.useURL();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const href = url ?? Linking.createURL("auth");
    void createSessionFromUrl(href)
      .catch(() => null)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (!ready) return null;
  return <Redirect href="/" />;
}
