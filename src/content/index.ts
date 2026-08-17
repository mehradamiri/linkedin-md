import type {
  ScrapeProgress,
  ScrapeRequest,
  ScrapeResponse,
} from "@/lib/messages"
import {
  CORE_SECTIONS,
  DETAIL_SECTIONS,
  hasContent,
  profileHandle,
  scrapeMainProfile,
  scrapeAnySection,
  sectionTitle,
  type DetailSection,
} from "@/lib/scrape"
import { isEmptySection, SECTION_SLUGS } from "@/lib/selectors"
import type { ExtraSection, GenericEntry, Profile } from "@/lib/types"

// The popup injects this file every time it opens, so a tab can receive it more than once.
// Registering the listener twice would answer each request twice.
declare global {
  interface Window {
    __linkedinMdReady?: boolean
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** How many section pages are read at once. Sequential reads made a full capture
 * take over a minute; unbounded ones would fire a dozen LinkedIn page loads at once. */
const CONCURRENCY = 3
const POLL_INTERVAL = 400
const POLL_ATTEMPTS = 30

type SectionOutcome =
  /** Rows were found. */
  | { status: "ok"; rows: unknown[] }
  /** The member has no such section — placeholder copy, or LinkedIn bounced us back. */
  | { status: "empty" }
  /** The page never produced rows and never said it was empty: a real gap. */
  | { status: "unreadable" }

/**
 * The current layout keeps almost nothing on the profile page itself — experience,
 * education, skills and languages live only on /in/{handle}/details/{section}/, and
 * that page's markup exists only after React hydrates it (fetching the HTML returns
 * an empty shell). So each section is rendered in a hidden same-origin iframe and
 * read with the same extractor. Same-origin means no new permissions: the page can
 * already frame its own URLs, and nothing leaves the tab.
 */
async function readSection(
  handle: string,
  section: DetailSection,
): Promise<SectionOutcome> {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1200px;height:3000px;border:0;opacity:0;pointer-events:none;"
  frame.src = `/in/${handle}/details/${SECTION_SLUGS[section]}/`
  document.body.appendChild(frame)

  try {
    await Promise.race([
      new Promise((resolve) => {
        frame.onload = resolve
      }),
      sleep(15000),
    ])

    // Hydration lands well after load, so poll for rows rather than guessing a delay.
    let rows: unknown[] = []
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL)
      const doc = frame.contentDocument
      if (!doc) continue

      // A section this member does not have at all sends us back to the profile.
      if (!doc.location.pathname.includes("/details/")) return { status: "empty" }

      rows = scrapeAnySection(doc, section)
      if (rows.length > 0) break

      // "Nothing to see for now" is an answer, not a slow render. Without this the
      // reader spends its entire polling budget on every unfilled section, which is
      // most of them for most members.
      if (isEmptySection(doc, section)) return { status: "empty" }
    }

    const win = frame.contentWindow
    const doc = frame.contentDocument
    if (!win || !doc) return rows.length > 0 ? { status: "ok", rows } : { status: "unreadable" }

    // Long lists render lazily. Scroll to the bottom until the row count stops
    // growing — a fixed 6000px sweep silently truncated anyone with a long list.
    let previous = -1
    for (let pass = 0; pass < 12 && rows.length !== previous; pass++) {
      previous = rows.length
      win.scrollTo(0, doc.body.scrollHeight)
      await sleep(500)
      const complete = scrapeAnySection(doc, section)
      if (complete.length > rows.length) rows = complete
    }

    if (rows.length > 0) return { status: "ok", rows }
    return isEmptySection(doc, section)
      ? { status: "empty" }
      : { status: "unreadable" }
  } finally {
    frame.remove()
  }
}

/** Runs `task` over `items`, at most `CONCURRENCY` at a time, reporting each section
 * as it starts and again as it finishes. */
async function mapSections(
  items: readonly DetailSection[],
  task: (section: DetailSection) => Promise<SectionOutcome>,
  onProgress: (
    section: DetailSection,
    done: number,
    outcome?: SectionOutcome,
  ) => void,
): Promise<Map<DetailSection, SectionOutcome>> {
  const results = new Map<DetailSection, SectionOutcome>()
  let next = 0
  let done = 0

  const worker = async () => {
    while (next < items.length) {
      const section = items[next++]
      onProgress(section, done)
      const outcome = await task(section)
      results.set(section, outcome)
      done += 1
      onProgress(section, done, outcome)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
  )
  return results
}

async function captureProfile(): Promise<Profile> {
  const url = window.location.href
  const handle = profileHandle(url)
  const profile = scrapeMainProfile(document, url)

  if (!profile.name) {
    throw new Error(
      "Couldn't find a profile on this page. Open a LinkedIn profile (linkedin.com/in/…), let it finish loading, and try again.",
    )
  }
  if (!handle) throw new Error("This page isn't a LinkedIn profile URL.")

  const outcomes = await mapSections(
    DETAIL_SECTIONS,
    async (section): Promise<SectionOutcome> => {
      try {
        return await readSection(handle, section)
      } catch {
        // A section that will not render is not a reason to lose the rest of the
        // profile — but it is recorded, not swallowed.
        return { status: "unreadable" } as SectionOutcome
      }
    },
    (section, done, outcome) => {
      const progress: ScrapeProgress = {
        type: "SCRAPE_PROGRESS",
        section,
        label: sectionTitle(section),
        done,
        total: DETAIL_SECTIONS.length,
        ...(outcome && {
          result: outcome.status,
          count: outcome.status === "ok" ? outcome.rows.length : 0,
        }),
      }
      // The popup may already be closed; a failed progress ping must not abort the read.
      chrome.runtime.sendMessage(progress).catch(() => {})
    },
  )

  const rowsFor = (section: DetailSection) => {
    const outcome = outcomes.get(section)
    if (outcome?.status === "unreadable") profile.warnings.push(sectionTitle(section))
    return outcome?.status === "ok" ? outcome.rows : []
  }

  profile.experience = rowsFor("experience") as Profile["experience"]
  profile.education = rowsFor("education") as Profile["education"]
  profile.skills = rowsFor("skills") as Profile["skills"]
  profile.languages = rowsFor("languages") as Profile["languages"]
  profile.certifications = rowsFor("certifications") as Profile["certifications"]

  const extras: ExtraSection[] = []
  for (const section of DETAIL_SECTIONS) {
    if ((CORE_SECTIONS as readonly string[]).includes(section)) continue
    const entries = rowsFor(section) as GenericEntry[]
    if (entries.length > 0)
      extras.push({ key: section, title: sectionTitle(section), entries })
  }
  profile.extras = extras

  if (!hasContent(profile)) {
    throw new Error(
      "Read the profile header but none of its sections. LinkedIn may have changed its layout, or the page didn't finish loading — reload the tab and try again.",
    )
  }

  return profile
}

/**
 * A capture takes tens of seconds and the popup closes on any click outside it, which
 * would otherwise throw the whole run away and start a fresh one — a dozen more page
 * loads — the next time it opened. The run therefore outlives the popup: a reopened
 * popup joins the capture already in flight, or is handed the finished one.
 *
 * Keyed on the handle rather than `location.href`, because LinkedIn rewrites the URL
 * with tracking parameters as you move around the page and an exact-match key would
 * miss for what is plainly the same profile.
 */
let inFlight: Promise<Profile> | null = null
let completed: { handle: string; profile: Profile } | null = null

function capture(force: boolean): Promise<Profile> {
  const handle = profileHandle(window.location.href)
  if (force) completed = null
  if (!force && handle && completed?.handle === handle)
    return Promise.resolve(completed.profile)
  if (!force && inFlight) return inFlight

  inFlight = captureProfile()
    .then((profile) => {
      if (handle) completed = { handle, profile }
      return profile
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

if (!window.__linkedinMdReady) {
  window.__linkedinMdReady = true

  chrome.runtime.onMessage.addListener(
    (
      message: ScrapeRequest,
      _sender,
      sendResponse: (response: ScrapeResponse) => void,
    ) => {
      if (message?.type !== "SCRAPE_PROFILE") return false

      capture(message.force === true)
        .then((profile) => sendResponse({ ok: true, profile }))
        .catch((error: unknown) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not read this page.",
          }),
        )

      // Reading the section pages is async; keep the message channel open.
      return true
    },
  )
}
