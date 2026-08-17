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
import { isEmptySection } from "@/lib/selectors"

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
      employmentType: "Full-time",
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

describe("scrapeHeader: a top card with a single company chip", () => {
  // Bill Gates's card, which is the common shape: one chip, rendered twice, with no
  // combined "Acme · University" line to give it away.
  const doc = parse(`
    <main><section>
      <div><h2>Bill Gates</h2></div>
      <div>Chair, Gates Foundation and Founder, Breakthrough Energy</div>
      <div><p>Gates Foundation</p></div>
      <div>Seattle, Washington, United States</div>
      <div>·</div>
      <div><p>Gates Foundation</p></div>
      <div><a href="https://gatesnot.es/tgn">https://gatesnot.es/tgn</a></div>
      <div>40,573,718 followers</div>
      <div>Followed by Ada and 54 others you know</div>
    </section></main>
  `)
  const profile = scrapeMainProfile(doc, URL)

  it("does not promote the chip into the location", () => {
    expect(profile.headline).toBe(
      "Chair, Gates Foundation and Founder, Breakthrough Energy",
    )
    expect(profile.location).toBe("Seattle, Washington, United States")
  })

  it("collects the member's own site", () => {
    expect(profile.websites).toEqual(["https://gatesnot.es/tgn"])
  })
})

describe("experience rows with an employment type", () => {
  const doc = parse(`
    <main><section>
      <div>Experience</div>
      <div>
        <div>
          <div><a href="/company/acme/">Acme Corp</a></div>
          <div>Full-time</div>
          <div>6 yrs</div>
          <ul>
            <li>
              <div>Staff Engineer</div><div>Full-time</div>
              <div>Jan 2022 - Present</div><div>Berlin, Germany</div>
            </li>
            <li>
              <div>Senior Engineer</div><div>Full-time</div>
              <div>Jan 2020 - Jan 2022</div><div>Berlin, Germany</div>
            </li>
          </ul>
        </div>
        <div>
          <div>Advisor</div><div>Other Co · Part-time</div>
          <div>2019 - 2020</div>
          <div>Led the platform team</div>
          <div>• Shipped the billing rewrite</div>
        </div>
      </div>
    </section></main>
  `)
  const experience = scrapeSection(doc, "experience")

  it("does not file a sub-role's company under its employment type", () => {
    expect(experience[0]).toMatchObject({
      title: "Staff Engineer",
      company: "Acme Corp",
      employmentType: "Full-time",
      location: "Berlin, Germany",
    })
    expect(experience.map((role) => role.company)).not.toContain("Full-time")
  })

  it("splits a standalone role's company from its employment type", () => {
    expect(experience[2]).toMatchObject({
      title: "Advisor",
      company: "Other Co",
      employmentType: "Part-time",
    })
  })

  it("does not mistake a short description opener for a location", () => {
    expect(experience[2].location).toBeUndefined()
    expect(experience[2].description).toContain("Led the platform team")
  })

  it("keeps bulleted description lines, as Markdown bullets", () => {
    expect(experience[2].description).toContain("- Shipped the billing rewrite")
  })
})

describe("rows whose text ends in the word 'logo'", () => {
  const doc = parse(`
    <main><section>
      <div>Experience</div>
      <div>
        <div>
          <div>Acme Corp logo</div><div>Designer</div>
          <div>Acme Corp · Full-time</div><div>2019 - 2020</div>
        </div>
        <div>
          <div>Brand Lead</div><div>Globex</div><div>2017 - 2019</div>
          <div>We redesigned the company logo</div>
        </div>
      </div>
    </section></main>
  `)
  const experience = scrapeSection(doc, "experience")

  it("drops an image caption that echoes a name the row already carries", () => {
    expect(experience[0].title).toBe("Designer")
  })

  it("keeps a sentence that merely ends in 'logo'", () => {
    expect(experience[1].description).toContain(
      "We redesigned the company logo",
    )
  })
})

describe("education and certification rows with more than two lines", () => {
  const educationDoc = parse(`
    <main><section>
      <div>Education</div>
      <div>
        <div>
          <div>Stanford University</div><div>Master's degree</div>
          <div>Computer Science</div><div>2010 - 2012</div>
          <div>Grade: 3.9</div>
        </div>
        <div>
          <div>TU Berlin</div><div>BSc</div><div>2006 - 2010</div>
        </div>
      </div>
    </section></main>
  `)

  it("keeps the field of study and the grade instead of dropping them", () => {
    const [stanford] = scrapeSection(educationDoc, "education")
    expect(stanford).toEqual({
      school: "Stanford University",
      degree: "Master's degree",
      dateRange: "2010 - 2012",
      description: "Computer Science\nGrade: 3.9",
    })
  })

  const certDoc = parse(`
    <main><section>
      <div>Licenses &amp; certifications</div>
      <div>
        <div>
          <div>AWS Certified</div><div>Amazon Web Services</div>
          <div>Issued Mar 2020</div><div>Expires Mar 2023</div>
          <div>Credential ID ABC123</div><div>Show credential</div>
        </div>
        <div>
          <div>CKA</div><div>The Linux Foundation</div>
          <div>Issued Jan 2021</div>
        </div>
      </div>
    </section></main>
  `)

  it("keeps the expiry date out of the issuer field, and the credential id", () => {
    const [aws] = scrapeSection(certDoc, "certifications")
    expect(aws).toEqual({
      title: "AWS Certified",
      issuer: "Amazon Web Services",
      dateRange: "Issued Mar 2020 · Expires Mar 2023",
      credentialId: "ABC123",
    })
  })
})

describe("skills whose endorsement count is an overlay chip", () => {
  const doc = parse(`
    <main><section>
      <div>Skills</div>
      <div>
        <div>
          <div>TypeScript</div>
          <a href="/in/jane/overlay/endorsements/">15 endorsements</a>
        </div>
        <div>
          <div>Rust</div>
        </div>
      </div>
    </section></main>
  `)

  it("reads the count back out of the chip textLines strips", () => {
    expect(scrapeSection(doc, "skills")).toEqual([
      { name: "TypeScript", endorsements: "15" },
      { name: "Rust" },
    ])
  })
})

describe("sections beyond the core five", () => {
  const doc = parse(`
    <main><section>
      <div>Publications</div>
      <div>
        <div>
          <div>On Distributed Systems</div><div>ACM Queue</div>
          <div>Mar 2021</div><div>A survey of consensus protocols.</div>
        </div>
        <div>
          <div>On Caching</div><div>USENIX</div><div>Jun 2019</div>
        </div>
      </div>
    </section></main>
  `)

  it("reads them as generic title/subtitle/date entries", () => {
    expect(scrapeSection(doc, "publications")).toEqual([
      {
        title: "On Distributed Systems",
        subtitle: "ACM Queue",
        dateRange: "Mar 2021",
        description: "A survey of consensus protocols.",
      },
      { title: "On Caching", subtitle: "USENIX", dateRange: "Jun 2019" },
    ])
  })
})

describe("isEmptySection", () => {
  it("recognises a details page the member never filled in", () => {
    const doc = parse(`
      <main><section>
        <div>Skills</div>
        <div>Nothing to see for now</div>
        <div>Skills that Jane adds will appear here.</div>
      </section></main>
    `)
    expect(isEmptySection(doc, "skills")).toBe(true)
  })

  it("does not call a populated page empty", () => {
    expect(isEmptySection(parse(skillsHtml), "skills")).toBe(false)
  })
})
