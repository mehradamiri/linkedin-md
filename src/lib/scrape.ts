import type { Profile } from "@/lib/types"

export function isProfileUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    return hostname.endsWith("linkedin.com") && /^\/in\/[^/]+/.test(pathname)
  } catch {
    return false
  }
}

/**
 * TODO: read the real profile out of the DOM.
 *
 * Kept pure over the Document (rather than reaching for `window`) so it can be unit-tested
 * against saved HTML fixtures without a browser. Every LinkedIn DOM assumption belongs in
 * a selectors module next to this one — see .claude/skills/linkedin-selectors.
 */
export function scrapeProfile(_doc: Document, url: string): Profile {
  return {
    url,
    name: "Placeholder Profile",
    headline: "Scraping is not implemented yet",
    location: "Somewhere on LinkedIn",
    about:
      "This is sample data. Replace scrapeProfile() with real DOM extraction.",
    experience: [
      {
        title: "Example Role",
        company: "Example Company",
        dateRange: "2024 — Present",
        location: "Remote",
        description: "Placeholder experience entry.",
      },
    ],
    education: [
      {
        school: "Example University",
        degree: "BSc, Example Studies",
        dateRange: "2018 — 2022",
      },
    ],
    skills: ["TypeScript", "Chrome Extensions", "Markdown"],
    scrapedAt: new Date().toISOString(),
  }
}
