// The trailing status glyph, copied from bb's own sidebar row.
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<PluginSidebarThread["indicator"], string>> = {
  "waiting-for-input": "CircleQuestion",
  "queued-waiting": "Clock",
  workflow: "Workflow",
  "background-agent": "UserRoundPlus",
  "background-command": "Terminal",
  "plan-mode": "ListTodo",
  goal: "Target",
};

export function ThreadStatus({ thread, className }: { thread: PluginSidebarThread; className?: string }) {
  const kind = thread.indicator;
  const label = thread.indicatorLabel ?? undefined;
  const size = "size-4 shrink-0";
  switch (kind) {
    case "none":
    case "draft":
      return null;
    case "unread-success":
      return (
        <span className={cn("flex size-4 items-center justify-center", className)} aria-label={label}>
          <span className="size-[5px] rounded-full bg-muted-foreground/60" />
        </span>
      );
    case "unread-error":
    case "queued-failed":
      return <Icon name="CircleX" className={cn(size, "text-destructive", className)} aria-label={label} />;
    case "runtime":
    case "working-draft":
      return (
        <Icon
          name="Loading"
          className={cn(size, "animate-spin text-sidebar-foreground motion-reduce:animate-none", className)}
          aria-label={label}
        />
      );
    case "waiting-for-input":
    case "queued-waiting":
      return <Icon name={ICONS[kind]!} className={cn(size, "text-muted-foreground/75", className)} aria-label={label} />;
    default:
      return <Icon name={ICONS[kind] ?? "Circle"} className={cn(size, "text-muted-foreground/50", className)} aria-label={label} />;
  }
}
