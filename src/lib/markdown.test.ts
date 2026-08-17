import { describe, expect, it } from "vitest"

import { AI_TARGETS, aiHandoff, MAX_PROMPT_URL } from "@/lib/ai-targets"
import { markdownFilename, profileToMarkdown } from "@/lib/markdown"
import { isProfileUrl } from "@/lib/scrape"
import type { Profile } from "@/lib/types"

const profile: Profile = {
  url: "https://www.linkedin.com/in/jane-doe",
  name: "Jane Doe",
  headline: "Staff Engineer",
  location: "Berlin, Germany",
  websites: ["https://jane.example"],
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
  extras: [],
  warnings: [],
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

describe("profileToMarkdown: fields the old serializer dropped or mangled", () => {
  it("lists the top card's external links", () => {
    expect(profileToMarkdown(profile)).toContain("- https://jane.example")
  })

  it("keeps the employment type alongside the dates", () => {
    const md = profileToMarkdown({
      ...profile,
      experience: [
        {
          title: "Staff Engineer",
          company: "Acme",
          employmentType: "Full-time",
          dateRange: "2022 — Present",
        },
      ],
    })

    expect(md).toContain("Full-time · 2022 — Present")
  })

  it("separates a multi-paragraph description into paragraphs", () => {
    const md = profileToMarkdown({
      ...profile,
      experience: [
        {
          title: "Staff Engineer",
          description: "First paragraph.\nSecond paragraph.",
        },
      ],
    })

    // A single newline renders as one run-on paragraph.
    expect(md).toContain("First paragraph.\n\nSecond paragraph.")
  })

  it("keeps consecutive bullets in one list", () => {
    const md = profileToMarkdown({
      ...profile,
      about: "- Shipped X\n- Shipped Y",
    })

    expect(md).toContain("- Shipped X\n- Shipped Y")
  })

  it("carries the credential id and the education description", () => {
    const md = profileToMarkdown({
      ...profile,
      education: [
        {
          school: "Stanford",
          degree: "Master's degree",
          description: "Computer Science",
        },
      ],
      certifications: [
        {
          title: "AWS Certified",
          issuer: "Amazon",
          dateRange: "Issued Mar 2020 · Expires Mar 2023",
          credentialId: "ABC123",
        },
      ],
    })

    expect(md).toContain("Computer Science")
    expect(md).toContain(
      "- AWS Certified — Amazon · Issued Mar 2020 · Expires Mar 2023 · Credential ID ABC123",
    )
  })

  it("renders extra sections under their own headings", () => {
    const md = profileToMarkdown({
      ...profile,
      extras: [
        {
          key: "publications",
          title: "Publications",
          entries: [
            {
              title: "On Distributed Systems",
              subtitle: "ACM",
              dateRange: "2021",
            },
          ],
        },
      ],
    })

    expect(md).toContain("## Publications")
    expect(md).toContain("### On Distributed Systems")
    expect(md).toContain("ACM · 2021")
  })

  it("names the sections that failed instead of looking complete", () => {
    const md = profileToMarkdown({ ...profile, warnings: ["Experience"] })

    expect(md).toContain("**Incomplete capture.**")
    expect(md).toContain("Experience")
  })

  it("escapes markdown syntax in headings and list items", () => {
    const md = profileToMarkdown({
      ...profile,
      name: "Jane *Doe*",
      skills: [{ name: "C++ [advanced]" }],
    })

    expect(md).toContain("# Jane \\*Doe\\*")
    expect(md).toContain("- C++ \\[advanced\\]")
  })
})

describe("aiHandoff", () => {
  const chatgpt = AI_TARGETS.find((t) => t.id === "chatgpt")!

  it("carries a short profile in the URL of an app that takes a prompt", () => {
    const { url, prefilled } = aiHandoff(chatgpt, "# Jane Doe\nStaff Engineer")
    expect(prefilled).toBe(true)
    expect(new URL(url).searchParams.get("q")).toBe("# Jane Doe\nStaff Engineer")
  })

  it("falls back to the clipboard rather than sending a truncated profile", () => {
    const { url, prefilled } = aiHandoff(chatgpt, "x".repeat(MAX_PROMPT_URL + 1))
    expect(prefilled).toBe(false)
    expect(url).toBe(chatgpt.home)
  })

  it("opens apps that take no prompt at their own front door", () => {
    const plain = { id: "x", name: "X", home: "https://example.com/" }
    expect(aiHandoff(plain, "# Jane Doe")).toEqual({
      url: plain.home,
      prefilled: false,
    })
  })

  it("points every target at https", () => {
    for (const target of AI_TARGETS) {
      expect(new URL(target.home).protocol).toBe("https:")
      if (target.prompt)
        expect(new URL(target.prompt.url).protocol).toBe("https:")
    }
  })
})
