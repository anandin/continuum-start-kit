import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Gateway() {
  const { user, loading } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="gateway-loading"
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/auth"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
