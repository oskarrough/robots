// Project actions on a project group header: rename, checkouts per machine, delete.
// The same items open from right-click on the header and from its "…" button.
import { useState, type ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useSdk, type PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { usePortalScopeProps } from "@/lib/portal-scope";
import { cn } from "@/lib/utils";

type Sdk = ReturnType<typeof useSdk>;
type Source = Awaited<ReturnType<Sdk["projects"]["get"]>>["sources"][number];
type Host = Awaited<ReturnType<Sdk["hosts"]["list"]>>[number];
type Details = { sources: Source[]; hosts: Host[] };
type Menu = typeof ContextMenu | typeof DropdownMenu;

const contentClass =
  "z-50 min-w-44 max-w-96 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md";
const itemClass =
  "flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent data-[state=open]:bg-accent";

/** Fetches sources and machines when a menu opens, so the list is never stale. */
function useProjectDetails(projectId: string) {
  const sdk = useSdk();
  const [details, setDetails] = useState<Details | null>(null);
  const load = () =>
    Promise.all([sdk.projects.get({ projectId }), sdk.hosts.list()])
      .then(([project, hosts]) => setDetails({ sources: project.sources, hosts }))
      .catch((error) => toast.error(`Couldn't load project: ${String(error)}`));
  return { sdk, details, load };
}

function run(task: Promise<unknown>, done: string, reload: () => void) {
  task.then(() => {
    toast.success(done);
    reload();
  }, (error) => toast.error(String(error)));
}

function Items({ P, project, details, sdk, reload }: {
  P: Menu;
  project: PluginSidebarProject;
  details: Details | null;
  sdk: Sdk;
  reload: () => void;
}) {
  const projectId = project.id;
  const hostName = (id: string) => details?.hosts.find((host) => host.id === id)?.name ?? id;

  const rename = () => {
    const name = window.prompt("Rename project", project.name)?.trim();
    if (name && name !== project.name) run(sdk.projects.update({ projectId, name }), `Renamed to ${name}`, reload);
  };
  const addCheckout = (host: Host) => {
    const suggestion = details?.sources[0]?.path ?? "";
    const path = window.prompt(`Path to ${project.name} on ${host.name}`, suggestion)?.trim();
    if (path) {
      run(sdk.projects.sources.add({ projectId, hostId: host.id, type: "local_path", path }), `Added checkout on ${host.name}`, reload);
    }
  };
  const changePath = (source: Source) => {
    const path = window.prompt(`Path on ${hostName(source.hostId)}`, source.path)?.trim();
    if (path && path !== source.path) {
      run(sdk.projects.sources.update({ projectId, sourceId: source.id, type: "local_path", path }), "Checkout updated", reload);
    }
  };
  const makeDefault = (source: Source) =>
    run(sdk.projects.sources.update({ projectId, sourceId: source.id, type: "local_path", isDefault: true }), "Default checkout changed", reload);
  const removeCheckout = (source: Source) => {
    if (window.confirm(`Remove the ${hostName(source.hostId)} checkout (${source.path}) from ${project.name}? Files on disk stay.`)) {
      run(sdk.projects.sources.delete({ projectId, sourceId: source.id }), "Checkout removed", reload);
    }
  };
  const deleteProject = () => {
    if (window.confirm(`Delete project ${project.name}? This can't be undone.`)) {
      run(sdk.projects.delete({ projectId }), `Deleted ${project.name}`, () => {});
    }
  };

  const item = (icon: string, label: ReactNode, onSelect: () => void, danger = false) => (
    <P.Item className={cn(itemClass, danger && "text-destructive")} onSelect={onSelect}>
      <Icon name={icon} className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </P.Item>
  );
  const subContent = (children: ReactNode) => (
    <P.Portal>
      <P.SubContent {...usePortalScopeProps()} className={contentClass} sideOffset={4}>
        {children}
      </P.SubContent>
    </P.Portal>
  );

  return (
    <>
      {item("Edit", "Rename…", rename)}
      <P.Separator className="-mx-1 my-1 h-px bg-border" />
      <P.Label className="px-2 py-1 text-xs text-muted-foreground">Checkouts</P.Label>
      {details === null && <div className="px-2 py-1.5 text-muted-foreground">Loading…</div>}
      {details?.sources.map((source) => (
        <P.Sub key={source.id}>
          <P.SubTrigger className={itemClass}>
            <Icon name="Folder" className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={source.path}>
              {hostName(source.hostId)} <span className="text-muted-foreground">{source.path}</span>
            </span>
            {source.isDefault && <span className="text-xs text-muted-foreground">default</span>}
            <Icon name="ChevronRight" className="size-3.5 shrink-0" aria-hidden />
          </P.SubTrigger>
          {subContent(
            <>
              {item("FolderSync", "Change path…", () => changePath(source))}
              {!source.isDefault && item("Check", "Make default", () => makeDefault(source))}
              {item("Trash2", "Remove…", () => removeCheckout(source), true)}
            </>,
          )}
        </P.Sub>
      ))}
      {details && (
        <P.Sub>
          <P.SubTrigger className={itemClass}>
            <Icon name="Plus" className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">Add checkout on…</span>
            <Icon name="ChevronRight" className="size-3.5 shrink-0" aria-hidden />
          </P.SubTrigger>
          {subContent(details.hosts.map((host) => (
            <P.Item key={host.id} className={itemClass} onSelect={() => addCheckout(host)}>
              <Icon name="Folder" className="size-4 shrink-0" aria-hidden />
              {host.name}
            </P.Item>
          )))}
        </P.Sub>
      )}
      <P.Separator className="-mx-1 my-1 h-px bg-border" />
      <P.Item asChild className={itemClass}>
        <a href={project.settingsHref}>
          <Icon name="Settings" className="size-4 shrink-0" aria-hidden />
          Project settings
        </a>
      </P.Item>
      {item("Trash2", "Delete project…", deleteProject, true)}
    </>
  );
}

export function ProjectContextMenu({ project, children }: { project: PluginSidebarProject; children: ReactNode }) {
  const { sdk, details, load } = useProjectDetails(project.id);
  const portalProps = usePortalScopeProps();
  return (
    <ContextMenu.Root onOpenChange={(open) => open && void load()}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content {...portalProps} className={contentClass}>
          <Items P={ContextMenu} project={project} details={details} sdk={sdk} reload={load} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function ProjectMenuButton({ project, className }: { project: PluginSidebarProject; className?: string }) {
  const { sdk, details, load } = useProjectDetails(project.id);
  const portalProps = usePortalScopeProps();
  return (
    <DropdownMenu.Root onOpenChange={(open) => open && void load()}>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label={`${project.name} actions`} title="Project actions" className={className}>
          <Icon name="MoreHorizontal" className="size-4" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content {...portalProps} className={contentClass} align="end">
          <Items P={DropdownMenu} project={project} details={details} sdk={sdk} reload={load} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
