# Contributing

Thanks for helping out. This project is small on purpose — it should stay easy to read in an
afternoon.

## Getting set up

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm build
```

Then load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `dist/`. Open a LinkedIn profile and click the icon.

After changing code, run `pnpm build` again and hit the **reload** button on the extension card
in `chrome://extensions`. (Changing only the popup? `pnpm dev` renders it in a normal tab — the
`chrome.*` APIs are missing there, so it lands in the "No profile here" state, which is still
enough to iterate on styling.)

## Before you open a PR

```bash
pnpm typecheck
pnpm lint
pnpm test
```

CI runs the same three.

## The things that matter here

**Selectors.** Every assumption about LinkedIn's DOM belongs in `src/lib/selectors.ts` as an
ordered list of fallback candidates — never a `querySelector` buried in feature code. LinkedIn
rotates its class names; keeping them in one file is what makes a redesign a twenty-minute fix
instead of a rewrite. The full playbook, including how to capture and **anonymize** an HTML
fixture, is in [`.claude/skills/linkedin-selectors`](.claude/skills/linkedin-selectors/SKILL.md).
It's written for Claude Code but reads fine as a human doc.

**Never commit a real person's profile.** Fixtures must be anonymized — fake names, employers,
schools; no member URNs, no media URLs, no profile links.

**Privacy is the product.** No network calls, no analytics, no remote code, no new permissions
beyond `activeTab` + `scripting`. A PR that adds any of those needs a very good reason and will
be discussed before it's merged.

**UI.** Use [shadcn/ui](https://ui.shadcn.com) components rather than hand-rolled markup —
`Alert` for callouts, `Empty` for empty states, `Skeleton` for loading, `sonner` for toasts. Add
new ones with `pnpm dlx shadcn@latest add <name>`. Semantic color tokens only (`text-muted-foreground`,
not `text-gray-500`).

**Scope.** This tool reads the profile page in front of you. It does not automate browsing, bulk
export, or touch LinkedIn's private APIs, and PRs in that direction will be declined.

## Reporting a broken scrape

LinkedIn ships redesigns without warning. If the extension starts returning empty or wrong
Markdown, open a **Broken extraction** issue and include which section broke and — anonymized —
the relevant HTML. That is genuinely the most useful contribution to this project.

## Commits and PRs

Small, focused PRs. Explain _why_ in the description; the diff already says what. If it changes
extraction behavior, it needs a test.

By contributing you agree your work is licensed under the [MIT License](LICENSE).
