export interface ExperienceEntry {
  title: string
  company?: string
  /** "Full-time", "Contract", … — the segment LinkedIn appends after the company. */
  employmentType?: string
  dateRange?: string
  location?: string
  description?: string
}

export interface EducationEntry {
  school: string
  degree?: string
  dateRange?: string
  /** Field of study, grade, activities — whatever the row carries past the degree. */
  description?: string
}

export interface SkillEntry {
  name: string
  /** As LinkedIn reports it — "15", or "99+" once it stops counting. */
  endorsements?: string
}

export interface LanguageEntry {
  name: string
  proficiency?: string
}

export interface CertificationEntry {
  title: string
  issuer?: string
  /** Issue and expiry joined, e.g. "Issued Mar 2020 · Expires Mar 2023". */
  dateRange?: string
  credentialId?: string
  description?: string
}

/** Publications, projects, volunteering, honors … — sections that all render as
 * title / subtitle / dates / prose and so need no bespoke parser. */
export interface GenericEntry {
  title: string
  subtitle?: string
  dateRange?: string
  description?: string
}

export interface ExtraSection {
  key: string
  /** Heading as it should appear in the Markdown, e.g. "Publications". */
  title: string
  entries: GenericEntry[]
}

/** The shape the content script returns and the Markdown serializer consumes. */
export interface Profile {
  /** Canonical profile URL, e.g. https://www.linkedin.com/in/jane-doe */
  url: string
  name: string
  headline?: string
  location?: string
  /** External links from the top card (personal site, newsletter, portfolio). */
  websites: string[]
  about?: string
  experience: ExperienceEntry[]
  education: EducationEntry[]
  skills: SkillEntry[]
  languages: LanguageEntry[]
  certifications: CertificationEntry[]
  /** Everything past the five core sections, in the order LinkedIn lists them. */
  extras: ExtraSection[]
  /**
   * Sections that were reached but could not be read. Without this a section that
   * failed is indistinguishable from one the member never filled in, and the export
   * silently looks complete.
   */
  warnings: string[]
  /** ISO-8601 timestamp of when the page was read. */
  scrapedAt: string
}
