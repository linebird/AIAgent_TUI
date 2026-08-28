import { STORAGE_KEYS } from "@/config/storage";

export function isTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function isTtsEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.ttsEnabled) === "true";
}

export function setTtsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ttsEnabled, String(enabled));
  if (!enabled) cancelSpeech();
}

export function cancelSpeech() {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}

function cleanTextForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*_>~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function koreanVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === "ko-KR")
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("ko"))
    || null;
}

export function speakChatText(text: string) {
  if (!isTtsSupported() || !isTtsEnabled()) return;

  const speechText = cleanTextForSpeech(text);
  if (!speechText) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  utterance.pitch = 1;

  const voice = koreanVoice();
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}
