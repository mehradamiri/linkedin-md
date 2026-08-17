# Privacy Policy

**LinkedIn → Markdown** collects nothing.

## What the extension does

When you click the extension icon on a LinkedIn profile page, it reads that page's content in
your browser and converts it to Markdown, which is shown in the popup. You can then copy it to
your clipboard, save it as a `.md` file to your computer, or hand it to an AI chat of your
choosing — see "Sending a profile to an AI chat" below.

LinkedIn keeps most of a profile off the profile page: experience, education, skills, languages
and certifications each live on their own page (`/in/…/details/experience/`, and so on). To
export a complete profile, the extension loads those LinkedIn pages inside the tab you are
already on — the same pages you would see by clicking "Show all" yourself, requested from
LinkedIn as you, and read in your browser. It reads only the profile whose page you clicked the
extension on.

## What it does not do

- **It does not send your data anywhere on its own.** There is no server, no backend, no API,
  and no analytics endpoint. The only requests it makes by itself are to LinkedIn, for that
  profile's own section pages. The single exception is the "Send to AI" button, which acts only
  when you click it and pick a destination — described below.
- **It does not collect analytics or telemetry.** No usage tracking, no crash reporting, no
  identifiers.
- **It keeps a capture only for the browser session.** Reading a profile means loading a dozen
  LinkedIn pages, so the finished Markdown is held in `chrome.storage.session` — memory only —
  to avoid repeating that work if you reopen the popup. It is never written to disk, and it is
  discarded when you quit the browser. Nothing goes to cookies or `localStorage`.
- **It does not load remote code.** All code ships in the extension package and is
  auditable in this repository.
- **It does not read other tabs.** It uses the `activeTab` permission, which grants access to a
  page only when you explicitly click the extension on it. It cannot run in the background, and
  cannot see your feed, messages, or any other site.

## Permissions

| Permission  | Why                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `activeTab` | Read the LinkedIn profile page you clicked the extension on. Granted per click, revoked afterward. |
| `scripting` | Inject the script that reads that page's content into Markdown.                                    |
| `storage`   | Hold the finished capture in memory for the browser session, so reopening the popup is instant.    |

The profile's section pages are loaded inside that same tab, which is same-origin with the page
you clicked on — so this needs no additional permission, and the extension still cannot reach
any other site or tab.

There are no `host_permissions`, so Chrome does not grant this extension standing access to any
site.

## Sending a profile to an AI chat

The popup has "Send to" buttons for ChatGPT and Claude. Choosing one opens that service in a new
tab and puts the Markdown on your clipboard. Where the service
accepts an opening prompt in its own URL, the profile travels in that URL so the chat opens
with it already there; otherwise you paste it yourself.

This is the one path by which profile data reaches a third party, and it happens only on that
click, only to the service you picked. Once the data is with that service it is governed by
that service's privacy policy, not this one. The extension has no account with any of them, is
not affiliated with either, and cannot read anything on their pages — it has no permission for
those sites, which is also why it cannot type into the chat box for you. If you would rather
not involve a third party, use "Copy" or "Download" instead; nothing is sent.

The popup also links to this project's GitHub repository and its Chrome Web Store listing.
Those are ordinary links: they open a page, and carry nothing about the profile you captured.

## Contact

Questions or concerns: open an issue at https://github.com/mehradamiri/linkedin-md/issues

_Last updated: 2026-08-17_
