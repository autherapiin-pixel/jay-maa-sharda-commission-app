import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { InvoiceForm } from "@/src/components/invoice-form";
import { useTheme } from "@/src/theme";

export default function NewInvoiceRoute() {
  const { colors } = useTheme();
  const { partyId } = useLocalSearchParams<{ partyId?: string }>();

  const { data: party, isLoading: pLoading } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => api.getParty(partyId as string),
    enabled: !!partyId,
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  if (!partyId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Text style={{ color: colors.muted }}>पहले पार्टी चुनें.</Text>
      </View>
    );
  }
  if (pLoading || !party) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <InvoiceForm
      mode="create"
      partyId={party.id}
      partyName={party.name}
      partyPhone={party.phone || ""}
      settings={settings}
    />
  );
}
