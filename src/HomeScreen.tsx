import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Language, languages, isRtlLanguage, Translation } from "./languages";
import { InputKind } from "./mediaFiles";
import { useTheme } from "./theme";
import { IconPlate, StudioButton, StudioIcon } from "./StudioUI";
export type Destination = "Earphones" | "Learn" | "Speak" | "Tools";
const tiles: {
  title: string;
  detail: string;
  icon: StudioIcon;
  color: string;
  destination: Destination;
}[] = [
  {
    title: "Earphones",
    detail: "Hear your translation",
    icon: "headset",
    color: "#65BCFF",
    destination: "Earphones",
  },
  {
    title: "Learning",
    detail: "Your word collection",
    icon: "book",
    color: "#B297FF",
    destination: "Learn",
  },
  {
    title: "Speaking",
    detail: "Practice your next conversation",
    icon: "chatbubbles",
    color: "#6BD6B1",
    destination: "Speak",
  },
];
type Props = {
  source: Language;
  target: Language;
  text: string;
  result: string;
  history: Translation[];
  busy: boolean;
  keyboard: boolean;
  onText: (text: string) => void;
  onPick: (side: "source" | "target") => void;
  onSwap: () => void;
  onTranslate: () => void;
  onListen: () => void;
  onCopy: () => void;
  onSave: (item?: Translation) => void;
  onHistory: () => void;
  onDestination: (destination: Destination) => void;
  onTool: (kind: InputKind) => void;
  onOpen: (item: Translation) => void;
};
export function HomeScreen(p: Props) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexGrow: 1, gap: 20 }}>
      {!p.keyboard && !p.result && (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_500Medium",
                fontSize: 14,
                color: c.muted,
              }}
            >
              Translation tools
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={p.busy}
              onPress={() => p.onDestination("Tools")}
            >
              <Text style={{ color: c.muted, padding: 8 }}>See all ›</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 2 }}
            style={{ flexGrow: 0 }}
          >
            {tiles.map((tile) => (
              <Pressable
                key={tile.title}
                accessibilityRole="button"
                accessibilityLabel={tile.title}
                disabled={p.busy}
                onPress={() => p.onDestination(tile.destination)}
                style={{
                  width: 158,
                  minHeight: 152,
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: c.surface,
                  gap: 13,
                }}
              >
                <IconPlate icon={tile.icon} color={tile.color} size={48} />
                <View style={{ gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 19,
                      color: c.ink,
                    }}
                  >
                    {tile.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_400Regular",
                      fontSize: 12,
                      lineHeight: 17,
                      color: c.muted,
                    }}
                  >
                    {tile.detail}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 14,
                  color: c.muted,
                }}
              >
                Recent translations
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={p.onHistory}
                disabled={p.busy}
              >
                <Text style={{ color: c.muted, padding: 8 }}>See all ›</Text>
              </Pressable>
            </View>
            {!p.history.length ? (
              <View
                style={{
                  padding: 20,
                  backgroundColor: c.surface,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21 }}>
                  Your translations will appear here. Type a message below or
                  try a speaking tool.
                </Text>
              </View>
            ) : (
              p.history.slice(0, 1).map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: c.surface,
                    borderRadius: 20,
                    padding: 17,
                    gap: 8,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reopen translation"
                    disabled={p.busy}
                    onPress={() => p.onOpen(item)}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: c.ink,
                        fontFamily: "Outfit_500Medium",
                        fontSize: 16,
                      }}
                    >
                      {item.original_text}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: c.muted,
                        fontFamily: "Outfit_400Regular",
                        fontSize: 14,
                        lineHeight: 21,
                        marginTop: 6,
                      }}
                    >
                      {item.translated_text}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save this phrase to learning"
                    disabled={p.busy}
                    onPress={() => p.onSave(item)}
                    style={{ alignSelf: "flex-start", padding: 5 }}
                  >
                    <Ionicons
                      name="bookmark-outline"
                      size={20}
                      color={c.muted}
                    />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </>
      )}
      <View style={{ gap: 12, marginTop: "auto", paddingTop: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {(
            [
              {
                kind: "document",
                label: "Document",
                icon: "document-text-outline",
              },
              {
                kind: "recording",
                label: "Audio",
                icon: "musical-notes-outline",
              },
              { kind: "call", label: "Call recording", icon: "call-outline" },
            ] as const
          ).map((tool) => (
            <Pressable
              key={tool.kind}
              accessibilityRole="button"
              disabled={p.busy}
              onPress={() => p.onTool(tool.kind)}
              style={{
                borderColor: c.line,
                borderWidth: 1,
                borderRadius: 13,
                paddingHorizontal: 13,
                minHeight: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Ionicons name={tool.icon} size={18} color={c.ink} />
              <Text
                style={{
                  color: c.ink,
                  fontFamily: "Outfit_400Regular",
                  fontSize: 13,
                }}
              >
                {tool.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View
          style={{
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: 22,
            padding: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose source language"
              disabled={p.busy}
              onPress={() => p.onPick("source")}
            >
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 15,
                  color: c.ink,
                }}
              >
                {languages[p.source].name} ⌄
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap languages"
              disabled={p.busy}
              onPress={p.onSwap}
            >
              <Ionicons name="swap-horizontal" size={20} color={c.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose target language"
              disabled={p.busy}
              onPress={() => p.onPick("target")}
            >
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 15,
                  color: c.ink,
                }}
              >
                {languages[p.target].name} ⌄
              </Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Text to translate"
            placeholder="Enter text to translate"
            placeholderTextColor={c.muted}
            multiline
            editable={!p.busy}
            value={p.text}
            onChangeText={p.onText}
            textAlignVertical="top"
            style={{
              minHeight: 85,
              maxHeight: 220,
              color: c.ink,
              fontFamily: "Outfit_400Regular",
              fontSize: 18,
              lineHeight: 27,
              textAlign: isRtlLanguage(p.source) ? "right" : "left",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: Array.from(p.text).length > 5000 ? c.error : c.muted,
                fontSize: 11,
              }}
            >
              30 languages · {Array.from(p.text).length} / 5,000
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dictate a message"
              disabled={p.busy}
              onPress={() => p.onTool("voice")}
              style={{
                height: 46,
                width: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.accent,
              }}
            >
              <Ionicons name="mic" size={24} color={c.accentText} />
            </Pressable>
          </View>
          {!!p.text.trim() && (
            <StudioButton
              title={p.busy ? "Translating…" : "Translate"}
              disabled={p.busy || Array.from(p.text).length > 5000}
              onPress={p.onTranslate}
            />
          )}
        </View>
        {!!p.result && (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: 22,
              padding: 18,
              gap: 14,
            }}
          >
            <Text
              selectable
              style={{
                fontFamily: "Outfit_500Medium",
                fontSize: 23,
                lineHeight: 32,
                color: c.ink,
                textAlign: isRtlLanguage(p.target) ? "right" : "left",
              }}
            >
              {p.result}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {(
                [
                  {
                    title: "Listen",
                    icon: "volume-high-outline",
                    action: p.onListen,
                  },
                  { title: "Copy", icon: "copy-outline", action: p.onCopy },
                  {
                    title: "Learn",
                    icon: "bookmark-outline",
                    action: () => p.onSave(),
                  },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  disabled={p.busy}
                  onPress={item.action}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    paddingVertical: 10,
                    paddingHorizontal: 6,
                  }}
                >
                  <Ionicons name={item.icon} size={21} color={c.accent} />
                  <Text style={{ color: c.accent, fontSize: 14 }}>
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <StudioButton
              title="New translation"
              secondary
              onPress={() => p.onText("")}
            />
          </View>
        )}
      </View>
    </View>
  );
}
export function ToolsScreen({
  onTool,
  onDestination,
}: {
  onTool: (kind: InputKind) => void;
  onDestination: (destination: Destination) => void;
}) {
  const { colors: c } = useTheme();
  const tools: {
    title: string;
    detail: string;
    icon: StudioIcon;
    color: string;
    action: () => void;
  }[] = [
    {
      title: "Text",
      detail: "Write in 30 languages",
      icon: "language",
      color: "#65BCFF",
      action: () => onTool("text"),
    },
    {
      title: "Face to face",
      detail: "Speak, review and translate",
      icon: "people",
      color: "#B297FF",
      action: () => onTool("voice"),
    },
    {
      title: "Earphones",
      detail: "Translate and play each turn",
      icon: "headset",
      color: "#65BCFF",
      action: () => onDestination("Earphones"),
    },
    {
      title: "Learn words",
      detail: "Review your saved collection",
      icon: "book",
      color: "#B297FF",
      action: () => onDestination("Learn"),
    },
    {
      title: "Speaking",
      detail: "Practice everyday phrases",
      icon: "chatbubbles",
      color: "#6BD6B1",
      action: () => onDestination("Speak"),
    },
    {
      title: "Document",
      detail: "PDF, DOCX and TXT",
      icon: "document-text",
      color: "#65BCFF",
      action: () => onTool("document"),
    },
    {
      title: "Audio",
      detail: "Record or import a clip",
      icon: "musical-notes",
      color: "#F2B26B",
      action: () => onTool("recording"),
    },
    {
      title: "Call recording",
      detail: "Translate an imported recording",
      icon: "call",
      color: "#6BD6B1",
      action: () => onTool("call"),
    },
  ];
  return (
    <View style={{ gap: 20 }}>
      <Text
        style={{ fontSize: 27, color: c.ink, fontFamily: "Outfit_600SemiBold" }}
      >
        All translation tools
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tools.map((tool) => (
          <Pressable
            key={tool.title}
            accessibilityRole="button"
            onPress={tool.action}
            style={{
              width: "48%",
              flexGrow: 1,
              minHeight: 176,
              backgroundColor: c.surface,
              borderRadius: 22,
              padding: 18,
              gap: 13,
            }}
          >
            <IconPlate icon={tool.icon} color={tool.color} />
            <View style={{ gap: 5 }}>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 18,
                }}
              >
                {tool.title}
              </Text>
              <Text
                style={{
                  color: c.muted,
                  fontFamily: "Outfit_400Regular",
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                {tool.detail}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
