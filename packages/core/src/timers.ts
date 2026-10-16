// Breeding timers (V2, D-25): incubation or gestation, maturation and mating cooldown, with the
// server's breeding multipliers. Shared by the tribe.

import { z } from "zod";
import type { RawSpecies, ServerMultipliers } from "./species";

/** A baby asks for a cuddle every 8 h at the official rate (ASB). */
export const CUDDLE_INTERVAL_S = 8 * 60 * 60;

export const TIMER_KINDS = ["birth", "maturation", "mating"] as const;
export type TimerKind = (typeof TIMER_KINDS)[number];

export interface BreedingTimes {
  /** Egg incubation, or gestation for live births. */
  birth: { kind: "incubation" | "gestation"; seconds: number };
  maturation: number;
  /** Time between two imprinting cuddles of a baby. */
  cuddleInterval: number;
  /** A female can mate again after a random time between the two. */
  matingCooldown: [number, number];
}

/** Breeding times of a species on a server; null for a species that does not breed. */
export function breedingTimes(raw: RawSpecies, m: ServerMultipliers): BreedingTimes | null {
  const b = raw.breeding;
  if (!b || b.maturationTime <= 0) return null;
  const gestation = b.gestationTime > 0;
  return {
    birth: {
      kind: gestation ? "gestation" : "incubation",
      seconds: (gestation ? b.gestationTime : b.incubationTime) / m.eggHatchSpeedMultiplier,
    },
    maturation: b.maturationTime / m.babyMatureSpeedMultiplier,
    cuddleInterval: CUDDLE_INTERVAL_S * m.babyCuddleIntervalMultiplier,
    matingCooldown: [b.matingCooldownMin * m.matingIntervalMultiplier, b.matingCooldownMax * m.matingIntervalMultiplier],
  };
}

/** How long a timer of this kind runs; the mating one ends when the female is ready for sure. */
export function timerDuration(times: BreedingTimes, kind: TimerKind): number {
  if (kind === "birth") return times.birth.seconds;
  if (kind === "maturation") return times.maturation;
  return times.matingCooldown[1];
}

/** Cuddles a baby asks for before adulthood (born at startsAt, adult at endsAt, times in ms). */
export function cuddleCount(startsAt: number, endsAt: number, cuddleIntervalS: number): number {
  const interval = cuddleIntervalS * 1000;
  return interval > 0 ? Math.max(0, Math.ceil((endsAt - startsAt) / interval) - 1) : 0;
}

/** Number of the last cuddle asked for at the time `now` (0 before the first one). */
export function cuddlesSoFar(startsAt: number, endsAt: number, cuddleIntervalS: number, now: number): number {
  const interval = cuddleIntervalS * 1000;
  if (interval <= 0 || now < startsAt) return 0;
  return Math.min(cuddleCount(startsAt, endsAt, cuddleIntervalS), Math.floor((now - startsAt) / interval));
}

/** Next imprinting cuddle of a maturing baby (born at `startsAt`), or null once adult. */
export function nextCuddle(startsAt: number, endsAt: number, cuddleIntervalS: number, now: number): number | null {
  const interval = cuddleIntervalS * 1000;
  if (interval <= 0 || now >= endsAt) return null;
  const next = startsAt + Math.max(1, Math.ceil((now - startsAt) / interval)) * interval;
  return next < endsAt ? next : null;
}

export interface Timer {
  id: string;
  speciesId: string;
  kind: TimerKind;
  /** Creature or egg name given by the player. */
  name: string;
  startsAt: string;
  endsAt: string;
  /** Imprinting cuddle interval when the timer was set (maturation), in seconds. */
  cuddleInterval: number | null;
  createdBy: string | null;
}

const MAX_TIMER_S = 60 * 24 * 60 * 60;

export const createTimerSchema = z.object({
  speciesId: z.string().min(1).max(200),
  kind: z.enum(TIMER_KINDS),
  name: z.string().trim().max(64),
  /** Already elapsed when the timer is set (egg laid a while ago…). */
  startsAt: z.iso.datetime(),
  durationSeconds: z.number().positive().max(MAX_TIMER_S),
  cuddleInterval: z.number().positive().max(MAX_TIMER_S).nullable(),
});
export type CreateTimerRequest = z.infer<typeof createTimerSchema>;

/** "2 j 5 h 36 min", "45 min", "30 s" (rounded to the minute from one minute up). */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d} j`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ") || "0 min";
}
