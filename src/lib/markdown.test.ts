import { describe, expect, it } from "vitest"

import { markdownFilename, profileToMarkdown } from "@/lib/markdown"
import { isProfileUrl } from "@/lib/scrape"
import type { Profile } from "@/lib/types"

const profile: Profile = {
  url: "https://www.linkedin.com/in/jane-doe",
  name: "Jane Doe",
  headline: "Staff Engineer",
  location: "Berlin, Germany",
  about: "Builds things.",
  experience: [
    {
      title: "Staff Engineer",
      company: "Acme",
      dateRange: "2022 — Present",
      location: "Remote",
    },
  ],
  education: [
    { school: "TU Berlin", degree: "BSc CS", dateRange: "2015 — 2019" },
  ],
  skills: ["TypeScript", "Rust"],
  scrapedAt: "2026-07-14T10:00:00.000Z",
}

describe("profileToMarkdown", () => {
  it("renders each populated section", () => {
    const md = profileToMarkdown(profile)

    expect(md).toContain("# Jane Doe")
    expect(md).toContain("## Experience")
    expect(md).toContain("**Acme** · 2022 — Present · Remote")
    expect(md).toContain("## Education")
    expect(md).toContain("TypeScript, Rust")
  })

  it("omits sections with no entries", () => {
    const md = profileToMarkdown({
      ...profile,
      about: undefined,
      experience: [],
      education: [],
      skills: [],
    })

    expect(md).not.toContain("## About")
    expect(md).not.toContain("## Experience")
    expect(md).not.toContain("## Skills")
  })
})

describe("markdownFilename", () => {
  it("slugifies the name and stamps the capture date", () => {
    expect(markdownFilename(profile)).toBe("jane-doe-2026-07-14.md")
  })
})

describe("isProfileUrl", () => {
  it.each([
    ["https://www.linkedin.com/in/jane-doe", true],
    ["https://linkedin.com/in/jane-doe/details/skills", true],
    ["https://www.linkedin.com/feed/", false],
    ["https://example.com/in/jane-doe", false],
    ["not-a-url", false],
  ])("%s -> %s", (url, expected) => {
    expect(isProfileUrl(url)).toBe(expected)
  })
})
