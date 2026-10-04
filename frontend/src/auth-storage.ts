import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "session_token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(v: string | null) {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return;
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
    return;
  }
  if (v) await SecureStore.setItemAsync(KEY, v);
  else await SecureStore.deleteItemAsync(KEY);
}
