import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function compareCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

/**
 * Returns true if the given delivery schedule is active on the provided date.
 * Uses local noon to avoid DST edge-cases when reading the day-of-month.
 *
 * Delivery types:
 *   Daily — every day
 *   Alt 1 — active on odd calendar dates (1, 3, 5…)
 *   Alt 2 — active on even calendar dates (2, 4, 6…)
 *   WE    — Isnin - Jumaat (Mon - Fri)
 *   WD    — Ahad - Khamis (Sun - Thu); off on Jumaat & Sabtu (Fri & Sat)
 *   WA    — Ahad, Selasa, Khamis only (Sun, Tue, Thu)
 */
export function isDeliveryActive(delivery?: string, date: Date = new Date()): boolean {
  if (!delivery) return true

  const dayOfWeek = date.getDay() // 0 = Sun … 6 = Sat
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const dateOfMonth = localNoon.getDate()

  switch (delivery) {
    case "Daily":
      return true
    case "Alt 1":
      return dateOfMonth % 2 !== 0
    case "Alt 2":
      return dateOfMonth % 2 === 0
    case "WE":
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case "WD":
      return dayOfWeek === 0 || (dayOfWeek >= 1 && dayOfWeek <= 4)
    case "WA":
      return dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4
    default:
      return true
  }
}

/**
 * Returns a human-readable description of a delivery schedule code,
 * shown to users e.g. in a tooltip/popover when they click a delivery cell.
 */
export function getDeliveryDescription(delivery?: string): string {
  if (!delivery) return "No delivery schedule set"

  switch (delivery) {
    case "Daily":
      return "Delivery Every Day"
    case "Alt 1":
      return "Delivery on Odd Dates Only (1, 3, 5…)"
    case "Alt 2":
      return "Delivery on Even Dates Only (2, 4, 6…)"
    case "WE":
      return "Delivery From Mon - Fri"
    case "WD":
      return "Delivery From Sun - Thu"
    case "WA":
      return "Delivery on Sun, Tue, and Thu only"
    default:
      return `Delivery: ${delivery}`
  }
}
