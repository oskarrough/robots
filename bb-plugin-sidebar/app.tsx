// bb-plugin-sidebar — replaces the sidebar thread list.
import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  definePluginApp,
  experimental_useSidebarThreadActions,
  experimental_useSidebarThreads,
  useSdk,
  type PluginSidebarProject,
  type PluginSidebarSection,
  type PluginSidebarThread,
  type PluginSidebarThreadActions,
  type PluginThreadListProps,
} from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { ThreadContextMenu, ThreadQuickActions } from "@/components/ThreadMenu";
import { ProjectContextMenu, ProjectMenuButton } from "@/components/ProjectMenu";
import { ThreadStatus } from "@/components/ThreadStatus";
import { cn } from "@/lib/utils";

function byPinOrder(a: PluginSidebarThread, b: PluginSidebarThread) {
  // Manually ordered pins first (by key), then the rest by when they were pinned, like bb.
  if (a.pinSortKey !== null && b.pinSortKey !== null) return a.pinSortKey < b.pinSortKey ? -1 : 1;
  if (a.pinSortKey !== null) return -1;
  if (b.pinSortKey !== null) return 1;
  return (a.pinnedAt ?? 0) - (b.pinnedAt ?? 0);
}

type Row = { thread: PluginSidebarThread; depth: number; childCount: number; isCollapsed: boolean };

const COLLAPSED_KEY = "bb-plugin-sidebar:collapsed";

/** Collapsed parent thread ids and section keys, kept in localStorage so they survive reloads. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

/**
 * How urgently a thread waits on you, lower first: a question or approval, then a failure,
 * then finished work you haven't looked at. Undefined when it isn't waiting.
 */
function urgency(thread: PluginSidebarThread): number | undefined {
  if (thread.hasPendingInteraction) return 0;
  if (thread.indicator === "unread-error") return 1;
  if (thread.indicator === "unread-success") return 2;
}

const newestFirst = (a: PluginSidebarThread, b: PluginSidebarThread) => b.createdAt - a.createdAt;

/** Each root followed by its descendants, depth-first, skipping the children of collapsed rows. */
function flattenTree(
  roots: PluginSidebarThread[],
  childrenOf: Map<string, PluginSidebarThread[]>,
  isCollapsed: (id: string) => boolean,
): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const walk = (thread: PluginSidebarThread, depth: number) => {
    if (seen.has(thread.id)) return;
    seen.add(thread.id);
    const children = childrenOf.get(thread.id) ?? [];
    const collapsed = children.length > 0 && isCollapsed(thread.id);
    rows.push({ thread, depth, childCount: children.length, isCollapsed: collapsed });
    if (!collapsed) for (const child of children) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return rows;
}

type GroupBy = "sections" | "projects" | "machines";
/** Where a new thread started from a group's + lands. */
type NewThreadTarget = Parameters<PluginSidebarThreadActions["openNewThread"]>[0];
type Group = { id: string; title: string; roots: PluginSidebarThread[]; newThread?: NewThreadTarget; project?: PluginSidebarProject };

const GROUP_BY_KEY = "bb-plugin-sidebar:group-by";
const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "sections", label: "Sections" },
  { value: "projects", label: "Projects" },
  { value: "machines", label: "Machines" },
];

function useGroupBy() {
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    const stored = localStorage.getItem(GROUP_BY_KEY);
    return GROUP_BY_OPTIONS.some((option) => option.value === stored) ? (stored as GroupBy) : "sections";
  });
  const choose = useCallback((next: GroupBy) => {
    localStorage.setItem(GROUP_BY_KEY, next);
    setGroupBy(next);
  }, []);
  return [groupBy, choose] as const;
}

/**
 * Splits unpinned root threads into groups. Named sections keep bb's creation order with
 * the loose "Threads" bucket last; machines sort by their newest thread. Projects go A–Z so
 * they stay put, those with threads first, then the empty ones.
 */
function groupRoots(
  roots: PluginSidebarThread[],
  groupBy: GroupBy,
  sections: readonly PluginSidebarSection[],
  projects: readonly PluginSidebarProject[],
): Group[] {
  const keyOf = (thread: PluginSidebarThread): Omit<Group, "roots"> => {
    if (groupBy === "projects") {
      const project = projects.find((candidate) => candidate.id === thread.projectId);
      return {
        id: `p-${thread.projectId}`,
        title: project?.name ?? "Unknown project",
        newThread: { projectId: thread.projectId },
        project: project?.isPersonal ? undefined : project,
      };
    }
    if (groupBy === "machines") {
      return thread.host
        ? { id: `m-${thread.host.id}`, title: thread.host.name, newThread: { hostId: thread.host.id } }
        : { id: "m-none", title: "No machine" };
    }
    const section = sections.find((candidate) => candidate.id === thread.sectionId);
    return section
      ? { id: `s-${section.id}`, title: section.name, newThread: { sectionId: section.id } }
      : { id: "threads", title: "Threads", newThread: {} };
  };

  const groups = new Map<string, Group>();
  for (const thread of roots) {
    const key = keyOf(thread);
    const group = groups.get(key.id);
    if (group) group.roots.push(thread);
    else groups.set(key.id, { ...key, roots: [thread] });
  }
  for (const group of groups.values()) group.roots.sort(newestFirst);

  if (groupBy === "sections") {
    const order = [...sections].sort((a, b) => a.createdAt - b.createdAt).map((section) => `s-${section.id}`);
    return [...order, "threads"].flatMap((id) => groups.get(id) ?? []);
  }
  if (groupBy !== "projects") {
    return [...groups.values()].sort((a, b) => b.roots[0].createdAt - a.roots[0].createdAt);
  }
  // bb's own project order, which you set by dragging. Projects without threads still get a
  // header, so you can start one there or manage the project.
  const ordered = projects.map((project) => groups.get(`p-${project.id}`) ?? {
    id: `p-${project.id}`,
    title: project.name,
    roots: [],
    newThread: { projectId: project.id },
    project: project.isPersonal ? undefined : project,
  });
  const listed = new Set(ordered.map((group) => group.id));
  return [...ordered, ...[...groups.values()].filter((group) => !listed.has(group.id))];
}

type DropTarget = { projectId: string; edge: "before" | "after" };

/**
 * Drag project headers to reorder them in bb's project list. The new order shows at once and
 * holds until bb sends back the saved one.
 */
function useProjectDrag(projects: readonly PluginSidebarProject[]) {
  const sdk = useSdk();
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [pending, setPending] = useState<{ from: readonly PluginSidebarProject[]; ids: string[] } | null>(null);

  const ordered =
    pending && pending.from === projects
      ? pending.ids.flatMap((id) => projects.find((project) => project.id === id) ?? [])
      : projects;

  const drop = (projectId: string, onto: DropTarget) => {
    if (projectId === onto.projectId) return;
    const ids = ordered.map((project) => project.id).filter((id) => id !== projectId);
    const index = ids.indexOf(onto.projectId) + (onto.edge === "after" ? 1 : 0);
    ids.splice(index, 0, projectId);
    setPending({ from: projects, ids });
    sdk.projects
      .reorder({ projectId, previousProjectId: ids[index - 1] ?? null, nextProjectId: ids[index + 1] ?? null })
      .catch((error) => {
        setPending(null);
        toast.error(`Couldn't move project: ${String(error)}`);
      });
  };

  const handlers = (projectId: string): HeaderDrag => ({
    indicator: dragging && dragging !== projectId && target?.projectId === projectId ? target.edge : null,
    onDragStart: (event) => {
      event.dataTransfer.effectAllowed = "move";
      setDragging(projectId);
    },
    onDragOver: (event) => {
      if (!dragging) return;
      event.preventDefault();
      const box = event.currentTarget.getBoundingClientRect();
      const edge = event.clientY < box.top + box.height / 2 ? "before" : "after";
      if (target?.projectId !== projectId || target.edge !== edge) setTarget({ projectId, edge });
    },
    onDrop: (event) => {
      event.preventDefault();
      if (dragging && target) drop(dragging, target);
      setDragging(null);
      setTarget(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setTarget(null);
    },
  });

  return { ordered, handlers };
}

function SidebarList({ activeThreadId, onNavigate }: PluginThreadListProps) {
  // Active lifecycle only by default, so archived threads never arrive.
  const { status, threads, sections, projects } = experimental_useSidebarThreads();
  const { collapsed, toggle } = useCollapsed();
  const [groupBy, setGroupBy] = useGroupBy();
  const actions = experimental_useSidebarThreadActions();
  // Opening a thread marks it read; this keeps it in Your move, in place, until you leave it.
  const yourMoveRanks = useRef(new Map<string, number>());
  const projectDrag = useProjectDrag(projects);

  if (status === "loading") return null;
  if (status === "error") return <div className="p-3 text-sm">Couldn't load threads.</div>;

  const visible = threads.filter((thread) => !thread.isHidden);
  const ids = new Set(visible.map((thread) => thread.id));
  const childrenOf = new Map<string, PluginSidebarThread[]>();
  const roots: PluginSidebarThread[] = [];
  for (const thread of visible) {
    const parentId = thread.parentThreadId;
    if (parentId === null || parentId === thread.id || !ids.has(parentId)) {
      roots.push(thread);
      continue;
    }
    const siblings = childrenOf.get(parentId);
    if (siblings) siblings.push(thread);
    else childrenOf.set(parentId, [thread]);
  }
  for (const siblings of childrenOf.values()) siblings.sort(newestFirst);

  // Keep the open thread reachable: its ancestors stay expanded whatever was saved.
  const byId = new Map(visible.map((thread) => [thread.id, thread]));
  const activeAncestors = new Set<string>();
  for (let id = byId.get(activeThreadId ?? "")?.parentThreadId; id && !activeAncestors.has(id); id = byId.get(id)?.parentThreadId) {
    activeAncestors.add(id);
  }
  const isCollapsed = (id: string) => collapsed.has(id) && !activeAncestors.has(id);

  const ranks = new Map<string, number>();
  for (const thread of visible) {
    const rank = urgency(thread) ?? (thread.id === activeThreadId ? yourMoveRanks.current.get(thread.id) : undefined);
    if (rank !== undefined) ranks.set(thread.id, rank);
  }
  yourMoveRanks.current = ranks;
  const yourMove = visible
    .filter((thread) => ranks.has(thread.id))
    .sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)! || newestFirst(a, b));
  const pinned = flattenTree(roots.filter((thread) => thread.isPinned).sort(byPinOrder), childrenOf, isCollapsed);
  const groups = groupRoots(roots.filter((thread) => !thread.isPinned), groupBy, sections, projectDrag.ordered);

  const rowProps = { activeThreadId, onNavigate, onToggle: toggle };
  const newThread = (target: NewThreadTarget) => {
    onNavigate();
    actions.openNewThread({ ...target, focusPrompt: true });
  };
  return (
    <div className="flex flex-col gap-2 p-1 text-sm">
      <div role="radiogroup" aria-label="Group threads by" className="flex gap-1 px-1 text-xs">
        {GROUP_BY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={groupBy === option.value}
            className={cn(
              "h-6 rounded-md px-2 text-sidebar-foreground/75 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2",
              groupBy === option.value && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            onClick={() => setGroupBy(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {yourMove.length > 0 && (
        <Section id="your-move" title="Your move" collapsed={collapsed} onToggle={toggle}>
          <ThreadRows rows={yourMove.map((thread) => ({ thread, depth: 0, childCount: 0, isCollapsed: false }))} {...rowProps} />
        </Section>
      )}
      {pinned.length > 0 && (
        <Section
          id="pinned"
          title="Pinned"
          collapsed={collapsed}
          onToggle={toggle}
          onNewThread={() => newThread({ experimental_placement: { sectionId: null, pinned: true } })}
        >
          <ThreadRows rows={pinned} {...rowProps} />
        </Section>
      )}
      {groups.map((group) => (
        <Section
          key={group.id}
          id={group.id}
          title={group.title}
          collapsed={collapsed}
          onToggle={toggle}
          onNewThread={group.newThread && (() => newThread(group.newThread))}
          project={group.project}
          drag={groupBy === "projects" && group.project ? projectDrag.handlers(group.project.id) : undefined}
        >
          <ThreadRows rows={flattenTree(group.roots, childrenOf, isCollapsed)} {...rowProps} />
        </Section>
      ))}
      {groupBy === "machines" && (
        <a
          href="/settings/machines"
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-sidebar-foreground/60 outline-none ring-sidebar-ring hover:text-sidebar-foreground focus-visible:ring-2"
          onClick={() => onNavigate()}
        >
          <Icon name="Plus" className="size-3" aria-hidden />
          Add machine
        </a>
      )}
    </div>
  );
}

type HeaderDrag = {
  indicator: DropTarget["edge"] | null;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

/** bb's quiet header buttons, shown while the header is hovered or the button is in use. */
const headerButtonClass =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-subtle-foreground opacity-0 outline-none ring-sidebar-ring hover:bg-state-hover hover:text-muted-foreground focus-visible:opacity-100 focus-visible:ring-2 active:bg-state-active data-[state=open]:bg-state-active data-[state=open]:opacity-100 [.section-header:hover>&]:opacity-100";

function Section({
  id,
  title,
  collapsed,
  onToggle,
  onNewThread,
  project,
  drag,
  children,
}: {
  id: string;
  title: string;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onNewThread?: () => void;
  project?: PluginSidebarProject;
  drag?: HeaderDrag;
  children: ReactNode;
}) {
  // Section keys share the collapsed set with thread ids, so prefix them.
  const key = `section:${id}`;
  const isCollapsed = collapsed.has(key);
  const header = (
    <h2
      className={cn(
        "section-header relative flex items-center",
        drag?.indicator &&
          "after:pointer-events-none after:absolute after:inset-x-1 after:h-0.5 after:rounded-full after:bg-sidebar-ring",
        drag?.indicator === "before" && "after:-top-px",
        drag?.indicator === "after" && "after:-bottom-px",
      )}
      draggable={drag !== undefined}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      onDragEnd={drag?.onDragEnd}
    >
      <button
        type="button"
        aria-expanded={!isCollapsed}
        className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-xs font-medium text-sidebar-foreground/75 outline-none ring-sidebar-ring hover:text-sidebar-foreground focus-visible:ring-2"
        onClick={() => onToggle(key)}
      >
        {title}
        <Icon name={isCollapsed ? "ChevronRight" : "ChevronDown"} className="size-3" aria-hidden />
      </button>
      {project && <ProjectMenuButton project={project} className={headerButtonClass} />}
      {onNewThread && (
        <button
          type="button"
          aria-label={`New thread in ${title}`}
          title="New thread"
          className={cn(headerButtonClass, "mr-1")}
          onClick={onNewThread}
        >
          <Icon name="Plus" className="size-4" aria-hidden />
        </button>
      )}
    </h2>
  );
  return (
    <section>
      {project ? <ProjectContextMenu project={project}>{header}</ProjectContextMenu> : header}
      {!isCollapsed && children}
    </section>
  );
}

function ThreadRows({
  rows,
  activeThreadId,
  onNavigate,
  onToggle,
}: { rows: Row[]; onToggle: (id: string) => void } & Pick<PluginThreadListProps, "activeThreadId" | "onNavigate">) {
  const actions = experimental_useSidebarThreadActions();
  return (
    <ul className="flex flex-col">
      {rows.map(({ thread, depth, childCount, isCollapsed }) => (
        <ThreadContextMenu key={thread.id} thread={thread}>
          <li
            className={cn(
              "sidebar-row flex h-7 items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground has-[[data-state=open]]:bg-sidebar-accent",
              thread.id === activeThreadId && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            style={{ paddingLeft: `${depth * 0.875}rem` }}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              {childCount > 0 && (
                <button
                  type="button"
                  aria-label={isCollapsed ? `Expand ${thread.displayTitle}` : `Collapse ${thread.displayTitle}`}
                  aria-expanded={!isCollapsed}
                  className="rounded text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  onClick={() => onToggle(thread.id)}
                >
                  <Icon name={isCollapsed ? "ChevronRight" : "ChevronDown"} className="size-3.5" aria-hidden />
                </button>
              )}
            </span>
            <a
              href={thread.href}
              className="min-w-0 flex-1 truncate pr-2 outline-none"
              onClick={(event) => {
                event.preventDefault();
                actions.open(thread.id);
                onNavigate();
              }}
            >
              {thread.displayTitle}
            </a>
            {isCollapsed && <span className="mr-1 text-xs text-sidebar-foreground/60">{childCount}</span>}
            <ThreadStatus
              thread={thread}
              className="mr-1.5 [.sidebar-row:focus-within>&]:hidden [.sidebar-row:has([data-state=open])>&]:hidden [.sidebar-row:hover>&]:hidden"
            />
            <span className="mr-1 hidden items-center has-[[data-state=open]]:flex [.sidebar-row:focus-within>&]:flex [.sidebar-row:hover>&]:flex">
              <ThreadQuickActions thread={thread} />
            </span>
          </li>
        </ThreadContextMenu>
      ))}
    </ul>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_threadList({
    id: "list",
    title: "Sidebar",
    description: "Oskar's sidebar. Pinned threads, then threads by section, project, or machine.",
    component: SidebarList,
  });
});
