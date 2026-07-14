import { useCallback, useEffect, useState } from "react"
import {
  isScrapeProgress,
  SCRAPE_REQUEST,
  type ScrapeResponse,
} from "@/lib/messages"
import { isProfileUrl } from "@/lib/scrape"
import type { Profile } from "@/lib/types"

export interface Progress {
  section: string
  done: number
  total: number
}

export type CaptureState =
  | { status: "loading"; progress?: Progress }
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

  // The content script reports which section it is reading; each one is a page load,
  // so the capture takes long enough that silence would look like a hang.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return

    const onProgress = (message: unknown) => {
      if (!isScrapeProgress(message)) return
      setState((current) =>
        current.status === "loading"
          ? {
              status: "loading",
              progress: {
                section: message.section,
                done: message.done,
                total: message.total,
              },
            }
          : current,
      )
    }

    chrome.runtime.onMessage.addListener(onProgress)
    return () => chrome.runtime.onMessage.removeListener(onProgress)
  }, [])

  return { state, retry: run }
}
