export interface ExperienceEntry {
  title: string
  company: string
  dateRange?: string
  location?: string
  description?: string
}

export interface EducationEntry {
  school: string
  degree?: string
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
  skills: string[]
  /** ISO-8601 timestamp of when the page was read. */
  scrapedAt: string
}
