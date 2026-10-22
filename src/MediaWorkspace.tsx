import React, { useEffect } from "react";
import {
  Alert,
  AppState,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useTheme } from "./theme";
import { useMediaInput } from "./useMediaInput";
import { isRtlLanguage } from "./languages";
type Props = {
  media: ReturnType<typeof useMediaInput>;
  kind: "document" | "recording" | "call";
  source: string;
  locked: boolean;
  onEdit: () => void;
};
export function MediaWorkspace({ media, kind, source, locked, onEdit }: Props) {
  const { colors: c } = useTheme();
  const player = useAudioPlayer(
    kind === "document" ? null : (media.file?.uri ?? null),
  );
  const playback = useAudioPlayerStatus(player);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        try {
          player.pause();
        } catch {}
      }
    });
    return () => {
      sub.remove();
      try {
        player.pause();
      } catch {}
    };
  }, [player]);
  const icon =
    kind === "document"
      ? "document-text-outline"
      : kind === "call"
        ? "call-outline"
        : "mic-outline";
  function button(
    label: string,
    onPress: () => void,
    disabled = locked,
    primary = false,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={{
          minHeight: 48,
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderRadius: 16,
          backgroundColor: primary ? c.accent : c.secondary,
          opacity: disabled ? 0.45 : 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Outfit_600SemiBold",
            fontSize: 14,
            color: primary ? c.accentText : c.ink,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  const start = () => {
    try {
      player.pause();
    } catch {}
    onEdit();
    void media.start();
  };
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 28,
        padding: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{ backgroundColor: c.tint, padding: 12, borderRadius: 17 }}
        >
          <Ionicons name={icon} size={25} color={c.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 20,
              color: c.ink,
            }}
          >
            {kind === "document"
              ? "Document translation"
              : kind === "call"
                ? "Call recording translation"
                : "Audio translation"}
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              color: c.muted,
            }}
          >
            {kind === "document"
              ? "PDF, DOCX or TXT · up to 8 MB"
              : "M4A, MP3, WAV, AAC, OGG, FLAC · 8 MB"}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontFamily: "Outfit_400Regular",
          fontSize: 14,
          lineHeight: 21,
          color: c.muted,
        }}
      >
        {kind === "document"
          ? "Import a document, review its text, then translate. The result is plain text; document formatting is not retained."
          : kind === "call"
            ? "Import a call recording already saved on your phone. This app does not record phone calls."
            : "Record a voice clip or import an audio file. Review the transcript before translating."}
      </Text>
      {media.recording ? (
        <View
          style={{
            gap: 12,
            alignItems: "center",
            padding: 16,
            backgroundColor: c.tealTint,
            borderRadius: 20,
          }}
        >
          <Ionicons name="radio" color={c.teal} size={36} />
          <Text
            style={{
              color: c.ink,
              fontSize: 21,
              fontFamily: "Outfit_600SemiBold",
            }}
          >
            Recording · 0:{String(media.seconds).padStart(2, "0")} / 1:00
          </Text>
          {button(
            "Stop recording",
            () => void media.stop(),
            media.working,
            true,
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {button(
            media.file
              ? "Choose another file"
              : kind === "document"
                ? "Import document"
                : kind === "call"
                  ? "Import call recording"
                  : "Import audio",
            () => {
              onEdit();
              void media.pick(kind);
            },
          )}
          {kind === "recording" &&
            button("Record a voice clip", () => {
              if (media.file)
                Alert.alert(
                  "Replace this file?",
                  "Your current file and transcript will be replaced.",
                  [
                    { text: "Keep file", style: "cancel" },
                    { text: "Record", onPress: start },
                  ],
                );
              else start();
            })}
        </View>
      )}
      {!!media.file && (
        <View
          style={{
            backgroundColor: c.secondary,
            borderRadius: 18,
            padding: 14,
            gap: 10,
          }}
        >
          <Text
            numberOfLines={2}
            style={{
              color: c.ink,
              fontFamily: "Outfit_500Medium",
              fontSize: 14,
            }}
          >
            {media.file.name}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {(media.file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
            {media.file.kind === "call"
              ? "Imported call recording"
              : media.file.kind === "document"
                ? "Document"
                : "Audio recording"}
          </Text>
          {kind !== "document" &&
            button(
              playback.playing ? "Pause preview" : "Play preview",
              () => {
                try {
                  if (playback.playing) player.pause();
                  else {
                    if (playback.didJustFinish)
                      void player.seekTo(0).then(() => player.play());
                    else player.play();
                  }
                } catch {
                  Alert.alert(
                    "Preview unavailable",
                    "You can still transcribe the recording, or export it in a supported format.",
                  );
                }
              },
              locked || !playback.isLoaded,
            )}
          {!media.draft &&
            button(
              media.working
                ? "Processing…"
                : kind === "document"
                  ? "Extract text for review"
                  : "Transcribe for review",
              () => {
                onEdit();
                void media.extract(source);
              },
              locked,
              true,
            )}
          {button("Remove file", () => {
            media.clear();
            onEdit();
          })}
        </View>
      )}
      {!!media.draft && (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: c.teal,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 14,
            }}
          >
            Review extracted text
          </Text>
          <TextInput
            accessibilityLabel="Extracted text. Edit before translating"
            multiline
            textAlignVertical="top"
            editable={!locked}
            value={media.draft}
            onChangeText={(text) => {
              media.setDraft(text);
              onEdit();
            }}
            style={{
              color: c.ink,
              fontFamily: "Outfit_400Regular",
              fontSize: 20,
              lineHeight: 30,
              minHeight: 150,
              maxHeight: 300,
              textAlign: isRtlLanguage(source) ? "right" : "left",
            }}
          />
          <Text
            style={{
              color: Array.from(media.draft).length > 5000 ? c.error : c.muted,
              fontSize: 12,
            }}
          >
            {Array.from(media.draft).length.toLocaleString()} / 5,000 characters
          </Text>
        </View>
      )}
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
        PDF and audio processing sends the selected file to Gemini when you tap
        Extract or Transcribe. Only confirmed text is saved in your history.
        Split longer documents or recordings into sections of up to 5,000
        characters.
      </Text>
    </View>
  );
}
