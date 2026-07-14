import type { Profile } from "@/lib/types"

/**
 * TODO: proper serializer — YAML front matter, Markdown escaping of profile text,
 * configurable sections. This minimal version exists so the popup has something to render.
 */
export function profileToMarkdown(profile: Profile): string {
  const lines = [`# ${profile.name}`, ""]

  if (profile.headline) lines.push(`> ${profile.headline}`, "")
  if (profile.location) lines.push(`📍 ${profile.location}`, "")
  if (profile.about) lines.push("## About", "", profile.about, "")

  if (profile.experience.length > 0) {
    lines.push("## Experience", "")
    for (const role of profile.experience) {
      lines.push(`### ${role.title}`, "")
      lines.push(
        [`**${role.company}**`, role.dateRange, role.location]
          .filter(Boolean)
          .join(" · "),
        "",
      )
      if (role.description) lines.push(role.description, "")
    }
  }

  if (profile.education.length > 0) {
    lines.push("## Education", "")
    for (const school of profile.education) {
      lines.push(`### ${school.school}`, "")
      lines.push(
        [school.degree, school.dateRange].filter(Boolean).join(" · "),
        "",
      )
    }
  }

  if (profile.skills.length > 0) {
    lines.push("## Skills", "", profile.skills.join(", "), "")
  }

  lines.push("---", "", `Source: [${profile.url}](${profile.url})`, "")

  return `${lines.join("\n").trim()}\n`
}

/** jane-doe-2026-07-14.md */
export function markdownFilename(profile: Profile): string {
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${slug || "linkedin-profile"}-${profile.scrapedAt.slice(0, 10)}.md`
}
