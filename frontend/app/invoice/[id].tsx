import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { InvoiceForm } from "@/src/components/invoice-form";
import { useTheme } from "@/src/theme";

export default function InvoiceDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.getInvoice(id),
    enabled: !!id,
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: party } = useQuery({
    queryKey: ["party", inv?.party_id],
    queryFn: () => api.getParty(inv!.party_id),
    enabled: !!inv?.party_id,
  });

  if (isLoading || !inv) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <InvoiceForm
      mode="edit"
      partyId={inv.party_id}
      partyName={inv.party_name}
      partyPhone={party?.phone || ""}
      settings={settings}
      initial={inv}
    />
  );
}
