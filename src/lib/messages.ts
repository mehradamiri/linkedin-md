import type { Profile } from "@/lib/types"

export interface ScrapeRequest {
  type: "SCRAPE_PROFILE"
  /** Discard any capture already held for this page and read it again. */
  force?: boolean
}

/**
 * Reading a profile means loading each section's page, so the popup is told where we
 * are rather than left on a spinner for half a minute. Each section reports twice:
 * once when its page starts loading, and again with `result` once it has been read —
 * which is what lets the popup show what was actually found while it is still working.
 */
export interface ScrapeProgress {
  type: "SCRAPE_PROGRESS"
  /** Section key, e.g. "experience". */
  section: string
  /** Heading as the popup should show it, e.g. "Licenses & certifications". */
  label: string
  done: number
  total: number
  /** Absent while the section is still being read. */
  result?: "ok" | "empty" | "unreadable"
  /** Rows found, when `result` is "ok". */
  count?: number
}

export type ScrapeResponse =
  { ok: true; profile: Profile } | { ok: false; error: string }

export const SCRAPE_REQUEST: ScrapeRequest = { type: "SCRAPE_PROFILE" }

export const scrapeRequest = (force = false): ScrapeRequest => ({
  type: "SCRAPE_PROFILE",
  force,
})

export function isScrapeProgress(message: unknown): message is ScrapeProgress {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as ScrapeProgress).type === "SCRAPE_PROGRESS"
  )
}
