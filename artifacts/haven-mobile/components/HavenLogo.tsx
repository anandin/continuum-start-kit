import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface HavenLogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function HavenLogo({ size = 28, showWordmark = true }: HavenLogoProps) {
  const colors = useColors();
  const badge = size + 14;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.badge,
          {
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <Feather
          name="heart"
          size={size - 6}
          color={colors.primaryForeground}
        />
      </View>
      {showWordmark ? (
        <Text style={[styles.wordmark, { color: colors.foreground }]}>
          Haven
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
});
