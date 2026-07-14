import type {
  ScrapeProgress,
  ScrapeRequest,
  ScrapeResponse,
} from "@/lib/messages"
import {
  DETAIL_SECTIONS,
  hasContent,
  profileHandle,
  scrapeMainProfile,
  scrapeSection,
  type DetailSection,
} from "@/lib/scrape"
import type { Profile } from "@/lib/types"

// The popup injects this file every time it opens, so a tab can receive it more than once.
// Registering the listener twice would answer each request twice.
declare global {
  interface Window {
    __linkedinMdReady?: boolean
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The current layout keeps almost nothing on the profile page itself — experience,
 * education, skills and languages live only on /in/{handle}/details/{section}/, and
 * that page's markup exists only after React hydrates it (fetching the HTML returns
 * an empty shell). So each section is rendered in a hidden same-origin iframe and
 * read with the same extractor. Same-origin means no new permissions: the page can
 * already frame its own URLs, and nothing leaves the tab.
 */
async function readSection<K extends DetailSection>(
  handle: string,
  section: K,
): Promise<Profile[K]> {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1200px;height:3000px;border:0;opacity:0;pointer-events:none;"
  frame.src = `/in/${handle}/details/${section}/`
  document.body.appendChild(frame)

  try {
    await Promise.race([
      new Promise((resolve) => {
        frame.onload = resolve
      }),
      sleep(15000),
    ])

    // Hydration lands well after load, so poll for rows rather than guessing a delay.
    let rows = [] as unknown as Profile[K]
    for (let i = 0; i < 30; i++) {
      await sleep(500)
      const doc = frame.contentDocument
      if (!doc) continue
      rows = scrapeSection(doc, section)
      if (rows.length > 0) break
    }

    // Long lists render lazily as they scroll into view.
    const win = frame.contentWindow
    const doc = frame.contentDocument
    if (win && doc) {
      for (let y = 0; y < 6000; y += 800) {
        win.scrollTo(0, y)
        await sleep(200)
      }
      await sleep(400)
      const complete = scrapeSection(doc, section)
      if (complete.length > rows.length) rows = complete
    }

    return rows
  } finally {
    frame.remove()
  }
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

  for (const [index, section] of DETAIL_SECTIONS.entries()) {
    const progress: ScrapeProgress = {
      type: "SCRAPE_PROGRESS",
      section,
      done: index,
      total: DETAIL_SECTIONS.length,
    }
    // The popup may already be closed; a failed progress ping must not abort the read.
    chrome.runtime.sendMessage(progress).catch(() => {})

    try {
      // Spelled out per section so each assignment keeps its own entry type.
      switch (section) {
        case "experience":
          profile.experience = await readSection(handle, "experience")
          break
        case "education":
          profile.education = await readSection(handle, "education")
          break
        case "skills":
          profile.skills = await readSection(handle, "skills")
          break
        case "languages":
          profile.languages = await readSection(handle, "languages")
          break
        case "certifications":
          profile.certifications = await readSection(handle, "certifications")
          break
      }
    } catch {
      // A section that will not render is not a reason to lose the rest of the profile.
    }
  }

  if (!hasContent(profile)) {
    throw new Error(
      "Read the profile header but none of its sections. LinkedIn may have changed its layout, or the page didn't finish loading — reload the tab and try again.",
    )
  }

  return profile
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

      captureProfile()
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
