import { useCallback, useEffect, useState } from "react"
import { SCRAPE_REQUEST, type ScrapeResponse } from "@/lib/messages"
import { isProfileUrl } from "@/lib/scrape"
import type { Profile } from "@/lib/types"

export type CaptureState =
  | { status: "loading" }
  | { status: "not-a-profile" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: Profile }

async function capture(): Promise<CaptureState> {
  // `pnpm dev` renders the popup in a plain tab, where the chrome.* APIs don't exist.
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return { status: "not-a-profile" }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id || !tab.url || !isProfileUrl(tab.url)) {
    return { status: "not-a-profile" }
  }

  // Injected on demand rather than declared in the manifest: with activeTab, the extension
  // only ever touches the page the user explicitly opened the popup on.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  })

  const response: ScrapeResponse = await chrome.tabs.sendMessage(
    tab.id,
    SCRAPE_REQUEST,
  )

  return response.ok
    ? { status: "ready", profile: response.profile }
    : { status: "error", message: response.error }
}

export function useProfileCapture() {
  const [state, setState] = useState<CaptureState>({ status: "loading" })

  const run = useCallback(() => {
    setState({ status: "loading" })
    capture()
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

  useEffect(run, [run])

  return { state, retry: run }
}
