/**
 * Where "Send to AI" can hand a profile off to.
 *
 * An extension cannot type into another site's composer without `host_permissions`
 * for that site, which this project deliberately does not ask for. So the handoff is
 * two-part: the Markdown always goes to the clipboard, and where the chat app accepts
 * a prompt in its own URL the tab opens with the profile already in it.
 *
 * Both halves are needed. The URL route is one click but caps out — the app reads the
 * query client-side and a long profile would arrive truncated, which is the one
 * failure this export must never have. Past `MAX_PROMPT_URL` we hand over by
 * clipboard instead and say so, rather than silently sending half a résumé.
 */
export interface AiTarget {
  id: string
  name: string
  /** Opened when the profile is too long to travel in the URL, or the app takes no prompt. */
  home: string
  /** Query parameter this app reads its opening prompt from, when it has one. */
  prompt?: { url: string; param: string }
}

export const AI_TARGETS: AiTarget[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    home: "https://chatgpt.com/",
    prompt: { url: "https://chatgpt.com/", param: "q" },
  },
  {
    id: "claude",
    name: "Claude",
    home: "https://claude.ai/new",
    prompt: { url: "https://claude.ai/new", param: "q" },
  },
]

/** Chrome navigates far longer URLs than this, but the receiving app parses the query
 * in JavaScript and long values are where truncation starts. Well under the limit on
 * purpose: a profile that does not comfortably fit goes by clipboard. */
export const MAX_PROMPT_URL = 8000

export interface Handoff {
  url: string
  /** True when the profile travels in the URL and the user has nothing to paste. */
  prefilled: boolean
}

export function aiHandoff(target: AiTarget, markdown: string): Handoff {
  if (!target.prompt) return { url: target.home, prefilled: false }

  const url = new URL(target.prompt.url)
  url.searchParams.set(target.prompt.param, markdown)
  const full = url.toString()

  return full.length <= MAX_PROMPT_URL
    ? { url: full, prefilled: true }
    : { url: target.home, prefilled: false }
}
