import { getDb } from "./db";

export interface EventSettings {
  eventMode: boolean;
  postEventMode: boolean;
  autoVerifyM4: boolean;
  maxTokenAttempts: number;
  registrationOpen: boolean;
  challengeDurationMin: number;
}

const DEFAULTS: EventSettings = {
  eventMode: false,
  postEventMode: false,
  autoVerifyM4: true,
  maxTokenAttempts: 5,
  registrationOpen: true,
  challengeDurationMin: 45,
};

export async function getSettings(): Promise<EventSettings> {
  const db = getDb();
  const rows = (await db.prepare(`SELECT key, value FROM event_settings`).all()) as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    eventMode: map.eventMode ? map.eventMode === "true" : DEFAULTS.eventMode,
    postEventMode: map.postEventMode ? map.postEventMode === "true" : DEFAULTS.postEventMode,
    autoVerifyM4: map.autoVerifyM4 ? map.autoVerifyM4 === "true" : DEFAULTS.autoVerifyM4,
    maxTokenAttempts: map.maxTokenAttempts ? parseInt(map.maxTokenAttempts, 10) : DEFAULTS.maxTokenAttempts,
    registrationOpen: map.registrationOpen ? map.registrationOpen === "true" : DEFAULTS.registrationOpen,
    challengeDurationMin: map.challengeDurationMin ? parseInt(map.challengeDurationMin, 10) : DEFAULTS.challengeDurationMin,
  };
}

export async function setSetting(key: keyof EventSettings, value: string | boolean | number): Promise<void> {
  const db = getDb();
  (await db.prepare(
    `INSERT INTO event_settings (key, value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value)));
}
