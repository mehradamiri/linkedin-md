import { scrapeProfile } from "@/lib/scrape"
import type { ScrapeRequest, ScrapeResponse } from "@/lib/messages"

// The popup injects this file every time it opens, so a tab can receive it more than once.
// Registering the listener twice would answer each request twice.
declare global {
  interface Window {
    __linkedinMdReady?: boolean
  }
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

      try {
        sendResponse({
          ok: true,
          profile: scrapeProfile(document, window.location.href),
        })
      } catch (error) {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not read this page.",
        })
      }

      return false
    },
  )
}
