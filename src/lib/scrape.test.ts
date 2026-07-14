import { describe, expect, it } from "vitest"

import certificationsEmptyHtml from "@/test/fixtures/details-certifications-empty-2026-07.html?raw"
import educationHtml from "@/test/fixtures/details-education-2026-07.html?raw"
import experienceHtml from "@/test/fixtures/details-experience-2026-07.html?raw"
import languagesHtml from "@/test/fixtures/details-languages-2026-07.html?raw"
import mainHtml from "@/test/fixtures/profile-main-2026-07.html?raw"
import skillsHtml from "@/test/fixtures/details-skills-2026-07.html?raw"
import {
  hasContent,
  isDateRangeLine,
  profileHandle,
  scrapeMainProfile,
  scrapeSection,
} from "@/lib/scrape"

const URL = "https://www.linkedin.com/in/jane-doe"

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html")

describe("scrapeMainProfile", () => {
  const profile = scrapeMainProfile(parse(mainHtml), URL)

  it("reads the header even though the layout has no h1", () => {
    expect(profile.name).toBe("Jane Doe")
    expect(profile.headline).toBe(
      "Principal Software Engineer · GenAI platforms",
    )
    // Not "Acme Corp · Example University": the company/school chips sit between the
    // headline and the location, and are told apart by being entity links.
    expect(profile.location).toBe("Berlin, Germany")
  })

  it("reads About without the UI chrome around it", () => {
    expect(profile.about).toContain("I build GenAI systems")
    expect(profile.about).toContain("Previously payments infrastructure")
    expect(profile.about).not.toContain("see more")
    expect(profile.about).not.toContain("About")
    // LinkedIn's footer, which sits inside <main>, links to "About".
    expect(profile.about).not.toContain("Accessibility")
    expect(profile.about).not.toContain("Privacy")
  })

  it("carries no sections: this layout keeps them on the details pages", () => {
    expect(profile.experience).toEqual([])
    expect(profile.skills).toEqual([])
  })
})

describe("scrapeSection: experience", () => {
  const experience = scrapeSection(parse(experienceHtml), "experience")

  it("flattens a grouped company and a standalone role into one list", () => {
    expect(experience).toHaveLength(3)
  })

  it("gives grouped sub-roles the company from the group header", () => {
    expect(experience[0]).toEqual({
      title: "Principal Software Engineer",
      company: "Acme Corp",
      dateRange: "Mar 2024 - Present · 2 yrs 5 mos",
      location: "On-site",
      description:
        "Anything GenAI related, from acceleration to designing new solutions",
    })
    expect(experience[1]).toMatchObject({
      title: "Senior Engineering Manager",
      company: "Acme Corp",
      location: "Berlin, Germany",
    })
  })

  it("reads the standalone role, which is a div and not a list item", () => {
    expect(experience[2]).toEqual({
      title: "CEO",
      company: "Globex",
      dateRange: "May 2016 - Jan 2020 · 3 yrs 9 mos",
      location: "Munich",
      description: "Globex was acquired by Acme Corp",
    })
  })

  it("keeps the role's skill chips out of its description", () => {
    expect(experience[2].description).not.toContain("Competitive Analysis")
  })

  it("ignores the ad units and the 'More profiles' aside inside main", () => {
    const titles = experience.map((role) => role.title)
    expect(titles).not.toContain("Kim Rivera")
    expect(titles.join(" ")).not.toMatch(/ad options|promoted/i)
  })
})

describe("scrapeSection: education", () => {
  const education = scrapeSection(parse(educationHtml), "education")

  it("reads rows nested under single-child wrappers", () => {
    expect(education).toHaveLength(3)
    expect(education[0]).toMatchObject({
      school: "Example University",
      degree: "Doctor of Philosophy (Ph.D.), Computer Engineering",
      dateRange: "2009 – 2014",
    })
    expect(education[2].school).toBe("Third Institute of Technology")
  })
})

describe("scrapeSection: skills", () => {
  const skills = scrapeSection(parse(skillsHtml), "skills")

  it("reads the list past the filter nav, and never the filter pills", () => {
    expect(skills.map((skill) => skill.name)).toEqual([
      "Competitive Analysis",
      "Algorithms",
      "CUDA",
      "TypeScript",
    ])
  })

  it("reads endorsement counts when present, keeping LinkedIn's '99+'", () => {
    expect(skills[0].endorsements).toBe("15")
    expect(skills[1].endorsements).toBe("99+")
    expect(skills[3].endorsements).toBeUndefined()
  })
})

describe("a section the member never filled in", () => {
  it("exports nothing rather than scraping LinkedIn's placeholder copy", () => {
    expect(
      scrapeSection(parse(certificationsEmptyHtml), "certifications"),
    ).toEqual([])
  })
})

describe("scrapeSection: languages", () => {
  it("reads rows that have neither a date nor an entity link", () => {
    expect(scrapeSection(parse(languagesHtml), "languages")).toEqual([
      { name: "English", proficiency: "Full professional proficiency" },
      { name: "French", proficiency: "Elementary proficiency" },
      { name: "German", proficiency: "Native or bilingual proficiency" },
    ])
  })
})

describe("scrapeMainProfile: a top card with no location", () => {
  it("leaves the location empty rather than promoting a company chip into it", () => {
    const doc = parse(`
      <main><section>
        <div><h2>Jane Doe</h2><span>· 1st</span></div>
        <div>Principal Software Engineer</div>
        <div><p><span>Acme Corp</span> · <span>Example University</span></p></div>
        <div><div><p>Acme Corp</p></div><div><p>Example University</p></div></div>
        <div>500+ connections</div>
        <div><button>Message</button></div>
      </section></main>
    `)
    const profile = scrapeMainProfile(doc, URL)
    expect(profile.headline).toBe("Principal Software Engineer")
    expect(profile.location).toBeUndefined()
  })
})

describe("a section that is absent", () => {
  it("yields no rows rather than throwing", () => {
    expect(scrapeSection(parse(mainHtml), "certifications")).toEqual([])
    expect(scrapeSection(parse("<main></main>"), "experience")).toEqual([])
  })
})

describe("empty page", () => {
  it("produces an empty profile instead of throwing", () => {
    const profile = scrapeMainProfile(parse("<main></main>"), URL)
    expect(profile.name).toBe("")
    expect(hasContent(profile)).toBe(false)
  })
})

describe("profileHandle", () => {
  it.each([
    ["https://www.linkedin.com/in/jane-doe", "jane-doe"],
    ["https://www.linkedin.com/in/jane-doe/details/skills/", "jane-doe"],
    ["https://www.linkedin.com/feed/", null],
  ])("%s -> %s", (url, expected) => {
    expect(profileHandle(url)).toBe(expected)
  })
})

describe("isDateRangeLine", () => {
  it.each([
    ["Mar 2024 - Present · 2 yrs 5 mos", true],
    ["2009 – 2014", true],
    ["Issued Mar 2021", true],
    ["Acme Corp · Full-time", false],
    ["Doctor of Philosophy (Ph.D.), Computer Engineering", false],
    ["On-site", false],
  ])("%s -> %s", (line, expected) => {
    expect(isDateRangeLine(line)).toBe(expected)
  })
})
