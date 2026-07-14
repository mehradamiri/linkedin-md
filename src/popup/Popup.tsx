import { useMemo, useState } from "react"
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  MapPinIcon,
  RefreshCwIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { markdownFilename, profileToMarkdown } from "@/lib/markdown"
import type { Profile } from "@/lib/types"
import {
  useProfileCapture,
  type Progress as CaptureProgress,
} from "@/popup/use-profile-capture"

function Header() {
  return (
    <header className="flex items-center gap-2 px-4 py-3">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <FileTextIcon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-none">
          LinkedIn → Markdown
        </span>
        <span className="text-xs text-muted-foreground">
          Copy or download this profile
        </span>
      </div>
    </header>
  )
}

function LoadingState({ progress }: { progress?: CaptureProgress }) {
  const pct = progress ? (progress.done / progress.total) * 100 : 8

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">
            {progress ? `Reading ${progress.section}…` : "Reading profile…"}
          </span>
          {progress ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {progress.done}/{progress.total}
            </span>
          ) : null}
        </div>
        <Progress value={pct} />
        <p className="text-xs text-muted-foreground">
          Each section lives on its own LinkedIn page, so this takes a few
          seconds. Leave the tab open.
        </p>
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function NotAProfile() {
  return (
    <Empty className="px-4 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>No profile here</EmptyTitle>
        <EmptyDescription>
          Open a LinkedIn profile page (linkedin.com/in/…) and click the
          extension again.
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
    <div className="flex flex-col gap-3 px-4 py-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Could not read this profile</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="self-start"
      >
        <RefreshCwIcon data-icon="inline-start" />
        Try again
      </Button>
    </div>
  )
}

function SectionBadges({ profile }: { profile: Profile }) {
  const counts: Array<[number, string, string]> = [
    [profile.experience.length, "role", "roles"],
    [profile.education.length, "school", "schools"],
    [profile.skills.length, "skill", "skills"],
    [profile.languages.length, "language", "languages"],
    [profile.certifications.length, "certification", "certifications"],
  ]
  const present = counts.filter(([count]) => count > 0)
  if (present.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {present.map(([count, singular, plural]) => (
        <Badge key={plural} variant="secondary">
          {count} {count === 1 ? singular : plural}
        </Badge>
      ))}
    </div>
  )
}

function ProfileView({ profile }: { profile: Profile }) {
  const [copied, setCopied] = useState(false)
  const markdown = useMemo(() => profileToMarkdown(profile), [profile])

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    toast.success("Markdown copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = markdownFilename(profile)
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Saved ${link.download}`)
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 px-4 pb-3">
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{profile.name}</span>
          {profile.headline ? (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {profile.headline}
            </span>
          ) : null}
          {profile.location ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3 shrink-0" />
              <span className="truncate">{profile.location}</span>
            </span>
          ) : null}
        </div>
        <SectionBadges profile={profile} />
      </div>

      <Separator />

      <ScrollArea className="h-64">
        <pre className="whitespace-pre-wrap wrap-break-word px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {markdown}
        </pre>
      </ScrollArea>

      <Separator />

      <div className="flex gap-2 px-4 py-3">
        <Button className="flex-1" onClick={handleCopy}>
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy Markdown"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleDownload}>
          <DownloadIcon data-icon="inline-start" />
          Download .md
        </Button>
      </div>
    </div>
  )
}

export function Popup() {
  const { state, retry } = useProfileCapture()

  return (
    <div className="w-104 bg-background text-foreground">
      <Header />
      <Separator />
      {state.status === "loading" ? (
        <LoadingState progress={state.progress} />
      ) : null}
      {state.status === "not-a-profile" ? <NotAProfile /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={retry} />
      ) : null}
      {state.status === "ready" ? (
        <ProfileView profile={state.profile} />
      ) : null}
      <Toaster position="bottom-center" />
    </div>
  )
}
