import { useCallback, useEffect, useState } from "react"
import {
  isScrapeProgress,
  scrapeRequest,
  type ScrapeResponse,
} from "@/lib/messages"
import { isProfileUrl, profileHandle } from "@/lib/scrape"
import type { Profile } from "@/lib/types"

/** What one section turned out to be, as the capture reports it back. */
export interface SectionProgress {
  key: string
  label: string
  result?: "ok" | "empty" | "unreadable"
  count: number
}

export interface Progress {
  /** Heading of the section currently being read. */
  label: string
  done: number
  total: number
  /** Every section seen so far, in the order the capture reported them. */
  sections: SectionProgress[]
}

export type CaptureState =
  | { status: "loading"; progress?: Progress }
  | { status: "not-a-profile" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: Profile; cached: boolean }

/**
 * Captures are cached in `chrome.storage.session` — memory only, cleared when the
 * browser closes, never written to disk. The content script already holds the run so
 * a closed popup does not lose it, but that copy dies with the page: reloading the
 * LinkedIn tab, or coming back to it later, would otherwise mean re-reading a dozen
 * section pages for a profile that was already captured.
 */
const cacheKey = (handle: string) => `profile:${handle}`

async function readCache(handle: string): Promise<Profile | null> {
  if (!chrome.storage?.session) return null
  try {
    const key = cacheKey(handle)
    const stored = (await chrome.storage.session.get(key)) as Record<
      string,
      Profile | undefined
    >
    return stored[key] ?? null
  } catch {
    return null
  }
}

async function writeCache(handle: string, profile: Profile): Promise<void> {
  if (!chrome.storage?.session) return
  try {
    await chrome.storage.session.set({ [cacheKey(handle)]: profile })
  } catch {
    // A full session store is not a reason to lose the capture in hand.
  }
}

async function capture(force: boolean): Promise<CaptureState> {
  // `pnpm dev` renders the popup in a plain tab, where the chrome.* APIs don't exist.
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return { status: "not-a-profile" }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id || !tab.url || !isProfileUrl(tab.url)) {
    return { status: "not-a-profile" }
  }

  const handle = profileHandle(tab.url)
  if (handle && !force) {
    const cached = await readCache(handle)
    if (cached) return { status: "ready", profile: cached, cached: true }
  }

  // Injected on demand rather than declared in the manifest: with activeTab, the extension
  // only ever touches the page the user explicitly opened the popup on.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  })

  const response: ScrapeResponse = await chrome.tabs.sendMessage(
    tab.id,
    scrapeRequest(force),
  )

  if (!response.ok) return { status: "error", message: response.error }
  if (handle) await writeCache(handle, response.profile)
  return { status: "ready", profile: response.profile, cached: false }
}

export function useProfileCapture() {
  const [state, setState] = useState<CaptureState>({ status: "loading" })

  const run = useCallback((force = false) => {
    setState({ status: "loading" })
    capture(force)
      .then(setState)
      .catch((error: unknown) =>
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not read the page. Try reloading the LinkedIn tab.",
        }),
      )
  }, [])

  useEffect(() => {
    run()
  }, [run])

  // The content script reports which section it is reading; each one is a page load,
  // so the capture takes long enough that silence would look like a hang.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return

    const onProgress = (message: unknown) => {
      if (!isScrapeProgress(message)) return
      setState((current) => {
        if (current.status !== "loading") return current

        // Each section reports twice — starting, then finished. Merge on the key so
        // the list reads as one row per section that fills in rather than growing.
        const sections = [...(current.progress?.sections ?? [])]
        const at = sections.findIndex((s) => s.key === message.section)
        const row: SectionProgress = {
          key: message.section,
          label: message.label,
          result: message.result,
          count: message.count ?? 0,
        }
        if (at >= 0) sections[at] = { ...sections[at], ...row }
        else sections.push(row)

        return {
          status: "loading",
          progress: {
            label: message.label,
            done: message.done,
            total: message.total,
            sections,
          },
        }
      })
    }

    chrome.runtime.onMessage.addListener(onProgress)
    return () => chrome.runtime.onMessage.removeListener(onProgress)
  }, [])

  return {
    state,
    /** Show whatever is already captured; only reads the page if nothing is. */
    retry: useCallback(() => run(false), [run]),
    /** Discard the cached capture and read the profile again. */
    recapture: useCallback(() => run(true), [run]),
  }
}
