import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth-context";

// Root entry: gate decides — logged in → tabs, else → login.
export default function Index() {
  const { loading, user } = useAuth();
  if (loading) return null;
  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
