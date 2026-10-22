import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Text,
  View,
} from "react-native";
import { useLearning } from "./useLearning";
import { Language, languages } from "./languages";
import { validCardText } from "./practice";
import { playSpeech } from "./deviceSpeech";
import { useTheme } from "./theme";
import {
  StudioButton,
  StudioCard,
  StudioText,
  StudioInput,
  IconPlate,
} from "./StudioUI";
export type WordDraft = {
  source: string;
  target: string;
  sourceLanguage: Language;
  targetLanguage: Language;
};
export function SaveWordDialog({
  draft,
  onClose,
  onSave,
  busy,
}: {
  draft: WordDraft | null;
  onClose: () => void;
  onSave: (draft: WordDraft) => Promise<boolean>;
  busy: boolean;
}) {
  const { colors: c } = useTheme();
  const [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setSource(draft?.source ?? "");
    setTarget(draft?.target ?? "");
    setError("");
  }, [draft]);
  return (
    <Modal
      visible={!!draft}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: c.overlay,
        }}
      >
        <View
          style={{
            maxHeight: "90%",
            backgroundColor: c.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            padding: 22,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 14, paddingBottom: 22 }}
          >
            <StudioText title>Save a word or phrase</StudioText>
            <StudioText muted>
              Select up to 300 characters on each side for your learning
              collection.
            </StudioText>
            <StudioText>
              {draft ? languages[draft.sourceLanguage].name : ""}
            </StudioText>
            <StudioInput
              value={source}
              onChangeText={setSource}
              label="Word or phrase"
              editable={!busy}
            />
            <StudioText muted>{Array.from(source).length} / 300</StudioText>
            <StudioText>
              {draft ? languages[draft.targetLanguage].name : ""}
            </StudioText>
            <StudioInput
              value={target}
              onChangeText={setTarget}
              label="Meaning or translation"
              editable={!busy}
            />
            <StudioText muted>{Array.from(target).length} / 300</StudioText>
            {!!error && <StudioText>{error}</StudioText>}
            <StudioButton
              title={busy ? "Saving…" : "Save to learning"}
              disabled={busy || !validCardText(source, target)}
              onPress={() => {
                if (draft)
                  void onSave({ ...draft, source, target }).then((saved) => {
                    if (saved) onClose();
                    else
                      setError(
                        "Could not save this word. Your text is kept; try again.",
                      );
                  });
              }}
            />
            <StudioButton
              title="Cancel"
              secondary
              disabled={busy}
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function LearningScreen({
  learning,
  onAdd,
  report,
}: {
  learning: ReturnType<typeof useLearning>;
  onAdd: () => void;
  report: (message: string) => void;
}) {
  const { colors: c } = useTheme();
  const [section, setSection] = useState<"review" | "collection">("review"),
    [revealed, setRevealed] = useState(false);
  const card = learning.cards.find(
    (item) => new Date(item.due_at).getTime() <= Date.now(),
  );
  useEffect(() => setRevealed(false), [card?.id]);
  const listen = (text: string, lang: Language) =>
    void playSpeech(text, lang).catch((error) => report(error.message));
  return (
    <View style={{ gap: 20 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <StudioText title>Your word collection</StudioText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh learning"
          disabled={learning.busy}
          onPress={() => void learning.load()}
        >
          <Text style={{ color: c.accent, padding: 10 }}>Refresh</Text>
        </Pressable>
      </View>
      <StudioCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <IconPlate icon="book-outline" color="#B297FF" />
          <View style={{ flex: 1 }}>
            <StudioText title>Learn a little, every day</StudioText>
            <StudioText muted>
              {learning.busy && !learning.cards.length
                ? "Loading your progress…"
                : `${learning.completed} of ${learning.goal} words reviewed today`}
            </StudioText>
          </View>
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: c.secondary,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 6,
              width: `${Math.min(100, (learning.completed / learning.goal) * 100)}%`,
              backgroundColor: c.accent,
            }}
          />
        </View>
        <StudioText muted>Daily goal</StudioText>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[5, 10, 20].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: learning.goal === value }}
              disabled={learning.busy}
              onPress={() => void learning.updateGoal(value)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  learning.goal === value ? c.accent : c.secondary,
              }}
            >
              <Text
                style={{
                  color: learning.goal === value ? c.accentText : c.ink,
                  fontFamily: "Outfit_600SemiBold",
                }}
              >
                {value} words
              </Text>
            </Pressable>
          ))}
        </View>
      </StudioCard>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <StudioButton
            title="Review"
            secondary={section !== "review"}
            onPress={() => setSection("review")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StudioButton
            title="Collection"
            secondary={section !== "collection"}
            onPress={() => setSection("collection")}
          />
        </View>
      </View>
      {section === "review" ? (
        card ? (
          <StudioCard>
            <StudioText muted>
              {languages[card.source_language].name} →{" "}
              {languages[card.target_language].name}
            </StudioText>
            <Text
              style={{
                fontSize: 29,
                lineHeight: 39,
                fontFamily: "Outfit_600SemiBold",
                color: c.ink,
                paddingVertical: 25,
              }}
            >
              {card.source_text}
            </Text>
            {revealed ? (
              <>
                <Text
                  style={{
                    fontSize: 26,
                    lineHeight: 36,
                    color: c.accent,
                    fontFamily: "Outfit_500Medium",
                  }}
                >
                  {card.translation}
                </Text>
                <StudioButton
                  title="Listen to meaning"
                  secondary
                  icon="volume-high-outline"
                  onPress={() => listen(card.translation, card.target_language)}
                />
                <StudioText muted>How well did you remember it?</StudioText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["again", "good", "easy"] as const).map((rating) => (
                    <View key={rating} style={{ flex: 1 }}>
                      <StudioButton
                        title={
                          rating === "again"
                            ? "Again"
                            : rating === "good"
                              ? "Got it"
                              : "Easy"
                        }
                        secondary
                        disabled={learning.busy}
                        onPress={() =>
                          void learning.review(card, rating).then((saved) => {
                            if (saved) void learning.load();
                          })
                        }
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <StudioButton
                title="Reveal meaning"
                onPress={() => setRevealed(true)}
              />
            )}
          </StudioCard>
        ) : (
          <StudioCard>
            <IconPlate icon="checkmark-circle-outline" color="#65CFB0" />
            <StudioText title>
              {learning.cards.length
                ? "You’re up to date"
                : "Start with words you use"}
            </StudioText>
            <StudioText muted>
              {learning.cards.length
                ? "Your next reviews appear when they are due. You can browse your collection or add a new word."
                : "Save a short word or phrase from any translation, or add one here."}
            </StudioText>
            <StudioButton title="Add a word" onPress={onAdd} />
          </StudioCard>
        )
      ) : (
        <View style={{ gap: 12 }}>
          {!learning.cards.length && (
            <StudioText muted>
              No saved words yet. Add your first word to begin.
            </StudioText>
          )}
          {learning.cards.map((item) => (
            <StudioCard key={item.id}>
              <StudioText muted>
                {languages[item.source_language].name} →{" "}
                {languages[item.target_language].name}
              </StudioText>
              <StudioText title>{item.source_text}</StudioText>
              <StudioText>{item.translation}</StudioText>
              <StudioText muted>
                Next review: {new Date(item.due_at).toLocaleDateString()}
              </StudioText>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <StudioButton
                    title="Listen"
                    secondary
                    onPress={() =>
                      listen(item.translation, item.target_language)
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <StudioButton
                    title="Remove"
                    secondary
                    disabled={learning.busy}
                    onPress={() =>
                      Alert.alert(
                        "Remove this word?",
                        "Its learning reviews will also be removed.",
                        [
                          { text: "Keep", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () => void learning.remove(item.id),
                          },
                        ],
                      )
                    }
                  />
                </View>
              </View>
            </StudioCard>
          ))}
          {learning.more && (
            <StudioButton
              title={learning.busy ? "Loading…" : "Load more words"}
              disabled={learning.busy}
              secondary
              onPress={() => void learning.load(true)}
            />
          )}
          <StudioButton title="Add a word" onPress={onAdd} />
        </View>
      )}
    </View>
  );
}
