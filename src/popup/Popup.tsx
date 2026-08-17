import { useMemo, useState } from "react"
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MapPinIcon,
  RefreshCwIcon,
  SearchXIcon,
  StarIcon,
  StoreIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { AI_TARGETS, aiHandoff, type AiTarget } from "@/lib/ai-targets"
import { markdownFilename, profileToMarkdown } from "@/lib/markdown"
import { DETAIL_SECTIONS, sectionTitle } from "@/lib/scrape"
import type { Profile } from "@/lib/types"
import { ChatGptLogo, ClaudeLogo } from "@/popup/ai-logos"
import {
  useProfileCapture,
  type CaptureState,
  type Progress as CaptureProgress,
} from "@/popup/use-profile-capture"

/* -------------------------------------------------------------------------- */
/* The manifest                                                               */
/*                                                                            */
/* One row per profile section, and the same component in both states: while   */
/* the capture runs the rows fill in as each section lands, and when it        */
/* finishes the list is the receipt of what went into the file. This is the    */
/* one question the product has to answer — a scraper's real failure mode is   */
/* quietly missing a section — so it gets the space, and everything around it  */
/* stays quiet.                                                               */
/* -------------------------------------------------------------------------- */

type RowState = "pending" | "found" | "empty" | "failed"

interface ManifestRow {
  key: string
  label: string
  state: RowState
  count?: number
}

function ManifestValue({ row }: { row: ManifestRow }) {
  if (row.state === "pending")
    return (
      <span
        aria-label="reading"
        className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50"
      />
    )
  if (row.state === "failed")
    return <TriangleAlertIcon aria-label="could not read" className="size-3 text-warning" />
  if (row.state === "empty")
    return <span className="text-muted-foreground/50">—</span>
  return (
    <span className="tabular-nums font-medium text-foreground">
      {row.count === undefined ? <CheckIcon className="size-3" /> : row.count}
    </span>
  )
}

function Manifest({ rows }: { rows: ManifestRow[] }) {
  if (rows.length === 0) return null

  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-px">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex items-center justify-between gap-2 py-0.5 text-xs"
        >
          <span
            className={
              row.state === "found"
                ? "truncate text-muted-foreground"
                : "truncate text-muted-foreground/60"
            }
          >
            {row.label}
          </span>
          <ManifestValue row={row} />
        </li>
      ))}
    </ul>
  )
}

/** Once the capture is done, the empty sections stop being news — the manifest
 * becomes a list of what is actually in the file, plus anything that failed. */
function manifestFromProfile(profile: Profile): ManifestRow[] {
  const rows: ManifestRow[] = []
  const add = (key: string, label: string, count: number) => {
    if (count > 0) rows.push({ key, label, state: "found", count })
  }

  if (profile.about)
    rows.push({ key: "about", label: "About", state: "found" })
  add("experience", "Experience", profile.experience.length)
  add("education", "Education", profile.education.length)
  add("skills", "Skills", profile.skills.length)
  add("languages", "Languages", profile.languages.length)
  add("certifications", "Certifications", profile.certifications.length)
  for (const section of profile.extras)
    add(section.key, section.title, section.entries.length)
  for (const warning of profile.warnings)
    rows.push({ key: `!${warning}`, label: warning, state: "failed" })

  return rows
}

function manifestFromProgress(progress?: CaptureProgress): ManifestRow[] {
  const reported = new Map(
    (progress?.sections ?? []).map((section) => [section.key, section]),
  )
  return DETAIL_SECTIONS.map((key) => {
    const section = reported.get(key)
    const state: RowState =
      section?.result === "ok"
        ? "found"
        : section?.result === "empty"
          ? "empty"
          : section?.result === "unreadable"
            ? "failed"
            : "pending"
    return { key, label: sectionTitle(key), state, count: section?.count }
  })
}

/* -------------------------------------------------------------------------- */
/* Chrome                                                                     */
/* -------------------------------------------------------------------------- */

/** The toolbar icon, redrawn in CSS so it follows the theme and stays crisp. */
function Mark() {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-primary text-[11px] font-black leading-none tracking-tight text-primary-foreground"
    >
      md
    </span>
  )
}

function BrandBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-11 items-center gap-2 px-3">
      <Mark />
      <span className="text-sm font-semibold tracking-tight">in.md</span>
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </header>
  )
}

/** Each mark in its owner's colour, so they read as themselves rather than as UI
 * icons. ChatGPT's follows the theme foreground — its mark is black on light, white
 * on dark. */
const AI_LOGOS = {
  chatgpt: { Logo: ChatGptLogo, className: "text-foreground" },
  claude: { Logo: ClaudeLogo, className: "text-[#D97757]" },
} as const

const GITHUB_URL = "https://github.com/mehradamiri/linkedin-md"
const REVIEW_URL =
  "https://chromewebstore.google.com/detail/linkedin-to-markdown/oommhmdoldhocnbfggngnihdfdfbmlmd/reviews"

/** The popup is torn down as the tab opens, and a popup blocker never gets a say. */
function openTab(url: string) {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) chrome.tabs.create({ url })
  else window.open(url, "_blank", "noopener,noreferrer")
}

function SupportLinks() {
  return (
    <div className="flex items-center justify-center gap-4 px-3 py-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => openTab(GITHUB_URL)}
        className="flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StarIcon className="size-3.5" />
        Star on GitHub
      </button>
      <span aria-hidden className="text-border">|</span>
      <button
        type="button"
        onClick={() => openTab(REVIEW_URL)}
        className="flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StoreIcon className="size-3.5" />
        Rate it on the Web Store
      </button>
    </div>
  )
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function LoadingState({ progress }: { progress?: CaptureProgress }) {
  const pct = progress ? (progress.done / progress.total) * 100 : 4
  const rows = manifestFromProgress(progress)

  return (
    <div className="flex flex-col gap-3 px-3 pb-4 pt-1">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {progress ? `Reading ${progress.label}…` : "Reading profile…"}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {progress ? `${progress.done}/${progress.total}` : null}
          </span>
        </div>
        <Progress value={pct} className="h-1" />
      </div>

      <Manifest rows={rows} />

      <p className="text-xs text-muted-foreground">
        Each section is a separate LinkedIn page. Keep the tab open — you can
        close this popup, the capture keeps running.
      </p>
    </div>
  )
}

function NotAProfile() {
  return (
    <Empty className="px-6 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>No profile on this tab</EmptyTitle>
        <EmptyDescription>
          Open someone's LinkedIn profile — a linkedin.com/in/… page — then click
          the extension.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-3 px-3 pb-4 pt-1">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Could not read this profile</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button size="sm" onClick={onRetry} className="self-start">
        <RefreshCwIcon data-icon="inline-start" />
        Try again
      </Button>
    </div>
  )
}

function MarkdownDisclosure({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false)
  const size = new Blob([markdown]).size
  const label =
    size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} kB`

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ChevronRightIcon
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {open ? "Hide Markdown" : "Show Markdown"}
        <span className="ml-auto tabular-nums">{label}</span>
      </button>
      {open ? (
        <>
          <Separator />
          <ScrollArea className="h-56 bg-muted/40">
            <pre className="whitespace-pre-wrap wrap-break-word px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/80">
              {markdown}
            </pre>
          </ScrollArea>
        </>
      ) : null}
    </div>
  )
}

function ProfileView({
  profile,
  onRecapture,
}: {
  profile: Profile
  onRecapture: () => void
}) {
  const [copied, setCopied] = useState(false)
  const markdown = useMemo(() => profileToMarkdown(profile), [profile])
  const rows = useMemo(() => manifestFromProfile(profile), [profile])
  const filename = markdownFilename(profile)
  const needsPaste = AI_TARGETS.some(
    (target) => !aiHandoff(target, markdown).prefilled,
  )

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    toast.success("Markdown copied")
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * The clipboard is loaded first and always — it is the half of the handoff that
   * cannot fail. Where the chat app takes a prompt in its URL the profile is already
   * there when the tab opens; otherwise the toast says what is waiting to be pasted.
   */
  async function handleSend(target: AiTarget) {
    const { url, prefilled } = aiHandoff(target, markdown)
    try {
      await navigator.clipboard.writeText(markdown)
    } catch {
      // A blocked clipboard should not stop the tab from opening.
    }
    openTab(url)
    toast.success(
      prefilled
        ? `Opening ${target.name} with the profile`
        : `Copied — paste the profile into ${target.name}`,
    )
  }

  function handleDownload() {
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Saved ${filename}`)
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="truncate text-base font-semibold tracking-tight">
            {profile.name}
          </h1>
          {profile.headline ? (
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              {profile.headline}
            </p>
          ) : null}
          {profile.location ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3 shrink-0" />
              <span className="truncate">{profile.location}</span>
            </p>
          ) : null}
        </div>

        <Manifest rows={rows} />

        {profile.warnings.length > 0 ? (
          <p className="flex gap-1.5 text-xs leading-snug text-muted-foreground">
            <TriangleAlertIcon className="mt-px size-3 shrink-0 text-warning" />
            <span>
              {profile.warnings.length === 1
                ? "One section could not be read and is missing from the file."
                : `${profile.warnings.length} sections could not be read and are missing from the file.`}{" "}
              <button
                type="button"
                onClick={onRecapture}
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              >
                Try again
              </button>
            </span>
          </p>
        ) : null}
      </div>

      <Separator />
      <MarkdownDisclosure markdown={markdown} />
      <Separator />

      <div className="flex flex-col gap-2 px-3 py-3">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleCopy}>
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy Markdown"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownload}
            title={`Download ${filename}`}
            aria-label={`Download ${filename}`}
          >
            <DownloadIcon />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Send to</span>
          {AI_TARGETS.map((target) => {
            const { Logo, className } =
              AI_LOGOS[target.id as keyof typeof AI_LOGOS]
            return (
              <Button
                key={target.id}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSend(target)}
              >
                <Logo data-icon="inline-start" className={`size-4 ${className}`} />
                {target.name}
              </Button>
            )
          })}
        </div>

        {needsPaste ? (
          <p className="text-xs text-muted-foreground">
            This profile is too long to travel in a link — it will be copied for
            you to paste in.
          </p>
        ) : null}
      </div>

      <Separator />
      <SupportLinks />
    </div>
  )
}

export function PopupView({
  state,
  onRetry,
  onRecapture,
}: {
  state: CaptureState
  onRetry: () => void
  onRecapture: () => void
}) {
  return (
    <div className="w-104 bg-background text-foreground">
      <BrandBar>
        {state.status === "ready" ? (
          <button
            type="button"
            onClick={onRecapture}
            title="Read the profile again"
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {relativeTime(state.profile.scrapedAt)}
            <RefreshCwIcon className="size-3" />
          </button>
        ) : null}
      </BrandBar>
      <Separator />

      {state.status === "loading" ? (
        <LoadingState progress={state.progress} />
      ) : null}
      {state.status === "not-a-profile" ? <NotAProfile /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={onRetry} />
      ) : null}
      {state.status === "ready" ? (
        <ProfileView profile={state.profile} onRecapture={onRecapture} />
      ) : null}

      <Toaster position="bottom-center" />
    </div>
  )
}

export function Popup() {
  const { state, retry, recapture } = useProfileCapture()
  return <PopupView state={state} onRetry={retry} onRecapture={recapture} />
}
