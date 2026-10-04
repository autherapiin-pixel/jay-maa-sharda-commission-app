import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { ColorValue, Platform } from "react-native";

import { fonts, useTheme } from "@/src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function icon(name: IconName, focusedName: IconName) {
  const TabIcon = ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={22} color={color as string} />
  );
  return TabIcon;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 86 : 66,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home-outline", "home") }} />
      <Tabs.Screen name="parties" options={{ title: "Parties", tabBarIcon: icon("people-outline", "people") }} />
      <Tabs.Screen name="new-invoice" options={{ title: "New Bill", tabBarIcon: icon("add-circle-outline", "add-circle") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings-outline", "settings") }} />
    </Tabs>
  );
}
