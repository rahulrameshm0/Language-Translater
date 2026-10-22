import { AppState } from "react-native";
import * as Speech from "expo-speech";
import { setAudioModeAsync } from "expo-audio";
import { voicePreference } from "./voicePreference";
import { languages, Language } from "./languages";
export async function deviceVoices(language: Language) {
  return (await Speech.getAvailableVoicesAsync())
    .filter(
      (voice) =>
        voice.language.toLowerCase().replace("_", "-").split("-")[0] ===
        languages[language].locale.toLowerCase().split("-")[0],
    )
    .sort(
      (a, b) =>
        voicePreference(b, languages[language].locale) -
        voicePreference(a, languages[language].locale),
    );
}
export async function playSpeech(
  text: string,
  language: Language,
  voice?: string,
  onDone?: () => void,
  onError?: (message: string) => void,
) {
  await Speech.stop();
  const voices = await deviceVoices(language);
  if (!voices.length)
    throw new Error(
      `No ${languages[language].name} speech voice is installed. Install one in your phone’s speech settings or read the text.`,
    );
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
  if (AppState.currentState !== "active")
    throw new Error("Return to the app and tap Play again.");
  Speech.speak(text, {
    rate: 0.95,
    language: languages[language].locale,
    voice:
      voices.find((item) => item.identifier === voice)?.identifier ??
      voices[0].identifier,
    useApplicationAudioSession: true,
    onDone,
    onStopped: onDone,
    onError: () => {
      onDone?.();
      onError?.(
        "Could not play speech. Check the selected audio output and phone volume.",
      );
    },
  });
}
export const stopSpeech = () => Speech.stop().catch(() => {});
