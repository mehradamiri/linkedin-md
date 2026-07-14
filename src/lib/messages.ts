import type { Profile } from "@/lib/types"

export interface ScrapeRequest {
  type: "SCRAPE_PROFILE"
}

/** Reading a profile means loading each section's page, so the popup is told where
 * we are rather than left on a spinner for ten-odd seconds. */
export interface ScrapeProgress {
  type: "SCRAPE_PROGRESS"
  /** Section currently being read, e.g. "experience". */
  section: string
  done: number
  total: number
}

export type ScrapeResponse =
  { ok: true; profile: Profile } | { ok: false; error: string }

export const SCRAPE_REQUEST: ScrapeRequest = { type: "SCRAPE_PROFILE" }

export function isScrapeProgress(message: unknown): message is ScrapeProgress {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as ScrapeProgress).type === "SCRAPE_PROGRESS"
  )
}
