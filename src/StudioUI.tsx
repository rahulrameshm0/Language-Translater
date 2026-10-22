import React from "react";
import { Pressable, Text, View, TextInput } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "./theme";
export type StudioIcon = React.ComponentProps<typeof Ionicons>["name"];
export function StudioButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: StudioIcon;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 26,
        backgroundColor: secondary ? c.secondary : c.accent,
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      {icon && (
        <Ionicons
          name={icon}
          color={secondary ? c.ink : c.accentText}
          size={20}
        />
      )}
      <Text
        style={{
          color: secondary ? c.ink : c.accentText,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function StudioCard({ children }: { children: React.ReactNode }) {
  const { colors: c } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 22,
        padding: 20,
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
export function StudioText({
  children,
  title = false,
  muted = false,
}: {
  children: React.ReactNode;
  title?: boolean;
  muted?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Text
      style={{
        color: muted ? c.muted : c.ink,
        fontFamily: title ? "Outfit_600SemiBold" : "Outfit_400Regular",
        fontSize: title ? 23 : 14,
        lineHeight: title ? 30 : 22,
      }}
    >
      {children}
    </Text>
  );
}
export function StudioInput({
  value,
  onChangeText,
  label,
  editable = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  editable?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={c.muted}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      multiline
      textAlignVertical="top"
      style={{
        backgroundColor: c.secondary,
        borderRadius: 16,
        color: c.ink,
        minHeight: 90,
        maxHeight: 220,
        padding: 16,
        fontFamily: "Outfit_400Regular",
        fontSize: 19,
        lineHeight: 28,
      }}
    />
  );
}
export function IconPlate({
  icon,
  color = "#64AFFF",
  size = 60,
}: {
  icon: StudioIcon;
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: 18,
        backgroundColor: color + "22",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={color} />
    </View>
  );
}
