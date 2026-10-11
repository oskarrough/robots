// Thread actions: the full set on right-click or the "…" button, pin and archive on hover.
import type { ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  experimental_useSidebarThreadActions,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { usePortalScopeProps } from "@/lib/portal-scope";
import { cn } from "@/lib/utils";

type MenuItem = { label: string; icon: string; danger?: boolean; run: () => void };

function useThreadMenuItems(thread: PluginSidebarThread): MenuItem[][] {
  const actions = experimental_useSidebarThreadActions();
  return [
    [
      { label: "Open in split", icon: "Columns2", run: () => actions.open(thread.id, { split: true }) },
      {
        label: "Rename",
        icon: "Edit",
        run: () => {
          const title = window.prompt("Rename thread", thread.displayTitle)?.trim();
          if (title && title !== thread.displayTitle) void actions.rename(thread.id, title);
        },
      },
      {
        label: thread.isPinned ? "Unpin" : "Pin",
        icon: thread.isPinned ? "PinOff" : "Pin",
        run: () => void actions.setPinned(thread.id, !thread.isPinned),
      },
      {
        label: thread.isUnread ? "Mark as read" : "Mark as unread",
        icon: thread.isUnread ? "MailOpen" : "Mail",
        run: () => void actions.setRead(thread.id, thread.isUnread),
      },
    ],
    [
      { label: "Archive", icon: "Archive", run: () => actions.archive(thread.id) },
      { label: "Delete", icon: "Trash2", danger: true, run: () => actions.requestDelete(thread.id) },
    ],
  ];
}

const contentClass =
  "z-50 min-w-44 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md";
const itemClass =
  "flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent";

function Items({ P, groups }: { P: typeof ContextMenu | typeof DropdownMenu; groups: MenuItem[][] }) {
  return groups.map((group, index) => (
    <P.Group key={index}>
      {index > 0 && <P.Separator className="-mx-1 my-1 h-px bg-border" />}
      {group.map((item) => (
        <P.Item
          key={item.label}
          className={cn(itemClass, item.danger && "text-destructive")}
          onSelect={item.run}
        >
          <Icon name={item.icon} className="size-4" aria-hidden />
          {item.label}
        </P.Item>
      ))}
    </P.Group>
  ));
}

export function ThreadContextMenu({ thread, children }: { thread: PluginSidebarThread; children: ReactNode }) {
  const groups = useThreadMenuItems(thread);
  const portalProps = usePortalScopeProps();
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content {...portalProps} className={contentClass}>
          <Items P={ContextMenu} groups={groups} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** Pin and archive shown directly on a hovered row, then "…" for the full menu. */
export function ThreadQuickActions({ thread }: { thread: PluginSidebarThread }) {
  const actions = experimental_useSidebarThreadActions();
  const groups = useThreadMenuItems(thread);
  const portalProps = usePortalScopeProps();
  const buttonClass =
    "rounded p-0.5 text-sidebar-foreground/75 hover:text-sidebar-foreground data-[state=open]:text-sidebar-foreground";
  return (
    <>
      <button
        type="button"
        aria-label={thread.isPinned ? `Unpin ${thread.displayTitle}` : `Pin ${thread.displayTitle}`}
        title={thread.isPinned ? "Unpin" : "Pin"}
        className={buttonClass}
        onClick={() => void actions.setPinned(thread.id, !thread.isPinned)}
      >
        <Icon name={thread.isPinned ? "PinOff" : "Pin"} className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Archive ${thread.displayTitle}`}
        title="Archive"
        className={buttonClass}
        onClick={() => actions.archive(thread.id)}
      >
        <Icon name="Archive" className="size-4" aria-hidden />
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={`${thread.displayTitle} actions`} title="More" className={buttonClass}>
            <Icon name="MoreHorizontal" className="size-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content {...portalProps} className={contentClass} align="end">
            <Items P={DropdownMenu} groups={groups} />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
