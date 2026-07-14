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
      description: "Owns the platform.",
    },
  ],
  education: [
    { school: "TU Berlin", degree: "BSc CS", dateRange: "2015 — 2019" },
  ],
  skills: [{ name: "TypeScript", endorsements: "3" }, { name: "Rust" }],
  languages: [{ name: "German", proficiency: "Native" }],
  certifications: [
    {
      title: "Cloud Architect",
      issuer: "Example Co",
      dateRange: "Issued 2021",
    },
  ],
  scrapedAt: "2026-07-14T10:00:00.000Z",
}

describe("profileToMarkdown", () => {
  it("renders each populated section", () => {
    const md = profileToMarkdown(profile)

    expect(md).toContain("# Jane Doe")
    expect(md).toContain("> Staff Engineer")
    expect(md).toContain("## Experience")
    expect(md).toContain("### Staff Engineer — Acme")
    expect(md).toContain("2022 — Present · Remote")
    expect(md).toContain("Owns the platform.")
    expect(md).toContain("## Education")
    expect(md).toContain("BSc CS · 2015 — 2019")
    expect(md).toContain("- TypeScript · 3 endorsements")
    expect(md).toContain("- Rust")
    expect(md).toContain("- German — Native")
    expect(md).toContain("- Cloud Architect — Example Co · Issued 2021")
    expect(md).toContain("captured 2026-07-14")
  })

  it("omits sections with no entries and never throws on missing fields", () => {
    const md = profileToMarkdown({
      ...profile,
      headline: undefined,
      location: undefined,
      about: undefined,
      experience: [{ title: "Advisor" }],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    })

    expect(md).not.toContain("## About")
    expect(md).not.toContain("## Education")
    expect(md).not.toContain("## Skills")
    expect(md).not.toContain("## Languages")
    expect(md).not.toContain("## Certifications")
    expect(md).toContain("### Advisor")
    expect(md).not.toContain("undefined")
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
