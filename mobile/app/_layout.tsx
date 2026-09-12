import "../global.css";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/src/lib/auth";
import { CatalogProvider } from "@/src/catalog";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNav />
    </AuthProvider>
  );
}

function RootNav() {
  const auth = useAuth();
  if (auth.loading) return null;

  const signedIn = Boolean(auth.session && auth.role);

  return (
    <CatalogProvider>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!auth.session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(auth.session && !auth.role)}>
          <Stack.Screen name="no-profile" />
        </Stack.Protected>
      </Stack>
    </CatalogProvider>
  );
}
