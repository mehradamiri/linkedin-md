export interface ExperienceEntry {
  title: string
  company?: string
  dateRange?: string
  location?: string
  description?: string
}

export interface EducationEntry {
  school: string
  degree?: string
  dateRange?: string
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
  dateRange?: string
}

/** The shape the content script returns and the Markdown serializer consumes. */
export interface Profile {
  /** Canonical profile URL, e.g. https://www.linkedin.com/in/jane-doe */
  url: string
  name: string
  headline?: string
  location?: string
  about?: string
  experience: ExperienceEntry[]
  education: EducationEntry[]
  skills: SkillEntry[]
  languages: LanguageEntry[]
  certifications: CertificationEntry[]
  /** ISO-8601 timestamp of when the page was read. */
  scrapedAt: string
}
