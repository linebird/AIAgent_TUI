import { STORAGE_KEYS } from "@/config/storage";

let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;

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

function loadVoices() {
  if (!isTtsSupported()) return [];
  window.speechSynthesis.getVoices();
  return window.speechSynthesis.getVoices();
}

export function warmupVoices() {
  if (!isTtsSupported()) return Promise.resolve([]);

  const voices = loadVoices();
  if (voices.length > 0) return Promise.resolve(voices);

  if (!voicesReadyPromise) {
    voicesReadyPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const finish = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", finish);
        resolve(loadVoices());
      };

      window.speechSynthesis.addEventListener("voiceschanged", finish);
      window.setTimeout(finish, 800);
    }).finally(() => {
      voicesReadyPromise = null;
    });
  }

  return voicesReadyPromise;
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
  const voices = loadVoices();
  return voices.find((voice) => voice.lang === "ko-KR")
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("ko"))
    || null;
}

function createUtterance(text: string) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  utterance.pitch = 1;

  const voice = koreanVoice();
  if (voice) utterance.voice = voice;

  return utterance;
}

export function primeSpeech() {
  if (!isTtsSupported()) return false;

  warmupVoices();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(createUtterance("음성 답변을 켰습니다."));
  return true;
}

export function speakChatText(text: string) {
  if (!isTtsSupported() || !isTtsEnabled()) return;

  const speechText = cleanTextForSpeech(text);
  if (!speechText) return;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(createUtterance(speechText));
}
