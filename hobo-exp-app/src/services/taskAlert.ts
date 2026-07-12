// Loud-ringtone + vibration alert when a new task is assigned to the
// attendant. Foreground only — push notifications use the Android channel
// configured in services/notifications.ts for the equivalent treatment in
// background.
//
// Asset: place a 1–5s loopable mp3 at assets/sounds/ringtone.mp3.
// Replace it any time without code changes.

import { Platform, Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Loop pattern: ring 700ms, pause 400ms — repeats until cancelled.
// `0` start delay + `true` repeat in RN's Vibration API.
const VIBRATION_PATTERN: number[] = [0, 700, 400, 700, 400];

// Maximum time the ringtone can run unattended before we auto-stop, so a
// phone left on a counter doesn't ring forever if no one taps the card.
// Kept short (10s) so a single alert is a brief attention-grab, not a
// drawn-out alarm — applies to both attendant new-task and manager/owner
// escalation rings.
const ALERT_TIMEOUT_MS = 10_000;

let player: AudioPlayer | null = null;
let timeout: ReturnType<typeof setTimeout> | null = null;
let isRinging = false;

// Tiny pub-sub so React components can render a "Stop ringtone" UI while
// the alert is active without prop-drilling state across the screen.
const listeners = new Set<(active: boolean) => void>();
function emit() {
  for (const fn of listeners) {
    try { fn(isRinging); } catch {}
  }
}

export function subscribeToTaskAlert(listener: (active: boolean) => void): () => void {
  listeners.add(listener);
  // Push current state immediately so a fresh subscriber doesn't miss the
  // already-running alert if it mounted late.
  try { listener(isRinging); } catch {}
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Configure the audio session so the ringtone plays even when iOS is in
 * silent mode (Ring/Silent switch off). Call once on app startup, not on
 * every alert — iOS only honours the change reliably when the session
 * is already in playback category before play() is invoked.
 */
export async function configureTaskAlertAudio(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'doNotMix',
    });
  } catch {
    // Non-fatal — older SDKs ignore unknown keys.
  }
}

/**
 * Start ringing + vibrating. Safe to call repeatedly — already-ringing
 * calls are a no-op, so a burst of new-task events doesn't stack alerts.
 */
export async function startTaskAlert(): Promise<void> {
  if (isRinging) return;
  isRinging = true;
  emit();

  try {
    Vibration.vibrate(VIBRATION_PATTERN, true);
  } catch {
    // Vibrator hardware may be missing on some emulators — ignore.
  }

  try {
    // Defensive: re-apply the audio mode in case the OS tore down the
    // session (e.g. after a phone call). configureTaskAlertAudio() is
    // also called once at app startup.
    await configureTaskAlertAudio();
    // Asset is bundled at build time. require() must be a literal so the
    // Metro bundler can find it.
    const source = require('../../assets/sounds/ringtone.mp3');
    player = createAudioPlayer(source);
    player.loop = true;
    player.volume = 1;
    player.play();
  } catch (e) {
    // If the audio asset is missing or the player can't start, vibration
    // alone still alerts the attendant. Log so the missing asset is
    // visible in dev without crashing the dashboard.
    console.warn('[taskAlert] audio failed to start:', e);
  }

  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    void stopTaskAlert();
  }, ALERT_TIMEOUT_MS);
}

/** Stop ringing + vibrating immediately. Safe to call when already stopped. */
export async function stopTaskAlert(): Promise<void> {
  if (!isRinging) return;
  isRinging = false;
  emit();

  try {
    Vibration.cancel();
  } catch {}

  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {}
    player = null;
  }

  // Avoid an empty branch lint warning on platforms without ringtone routing.
  if (Platform.OS === 'web') return;
}

export function isTaskAlertActive(): boolean {
  return isRinging;
}
