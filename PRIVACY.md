# Privacy Policy

**LinkedIn → Markdown** collects nothing.

## What the extension does

When you click the extension icon on a LinkedIn profile page, it reads that page's content in
your browser and converts it to Markdown, which is shown in the popup. You can then copy it to
your clipboard or save it as a `.md` file to your computer.

## What it does not do

- **It does not send data anywhere.** The extension makes no network requests. There is no
  server, no backend, no API. Profile content never leaves your machine.
- **It does not collect analytics or telemetry.** No usage tracking, no crash reporting, no
  identifiers.
- **It does not store anything.** Nothing is written to extension storage, cookies, or
  `localStorage`. Close the popup and the Markdown is gone.
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

There are no `host_permissions`, so Chrome does not grant this extension standing access to any
site.

## Contact

Questions or concerns: open an issue at https://github.com/mehradamiri/linkedin-md/issues

_Last updated: 2026-07-14_
