import type { Profile } from "@/lib/types"

export interface ScrapeRequest {
  type: "SCRAPE_PROFILE"
}

export type ScrapeResponse =
  { ok: true; profile: Profile } | { ok: false; error: string }

export const SCRAPE_REQUEST: ScrapeRequest = { type: "SCRAPE_PROFILE" }
