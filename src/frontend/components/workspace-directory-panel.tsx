"use client";

import { Folder, FolderOpen } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
} from "@/frontend/components/ui/sidebar";
import {
    ACTIVE_WORKSPACE_ID_SESSION_KEY,
    WORKSPACE_STATE_STORAGE_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

type WorkspaceDirectoryPanelSnapshot = ReturnType<typeof workspaceStateService.getActiveWorkspace>;

const SERVER_SNAPSHOT: WorkspaceDirectoryPanelSnapshot = null;

let cachedClientSnapshot: WorkspaceDirectoryPanelSnapshot = SERVER_SNAPSHOT;
let cachedClientSignature = "";

function subscribe(onStoreChange: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    function handleStorage(event: StorageEvent) {
        if (
            event.key !== WORKSPACE_STATE_STORAGE_KEY &&
            event.key !== ACTIVE_WORKSPACE_ID_SESSION_KEY
        ) {
            return;
        }

        onStoreChange();
    }

    function handleWorkspaceStateChanged() {
        onStoreChange();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(WORKSPACE_STATE_CHANGED_EVENT, handleWorkspaceStateChanged);

    return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(WORKSPACE_STATE_CHANGED_EVENT, handleWorkspaceStateChanged);
    };
}

function getSnapshot() {
    const activeWorkspace = workspaceStateService.getActiveWorkspace();
    const signature = activeWorkspace
        ? `${activeWorkspace.id}|${activeWorkspace.updatedAt}|${activeWorkspace.directoryName}`
        : "none";

    if (signature === cachedClientSignature) {
        return cachedClientSnapshot;
    }

    cachedClientSignature = signature;
    cachedClientSnapshot = activeWorkspace;
    return cachedClientSnapshot;
}

function getServerSnapshot() {
    return SERVER_SNAPSHOT;
}

export function WorkspaceDirectoryPanel() {
    const activeWorkspace = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const selectedDirectory = activeWorkspace?.directoryName ?? null;
    const directoryLabel = selectedDirectory ?? "No directory selected";

    return (
        <SidebarGroup className="gap-2">
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
                <div className="border-sidebar-border/70 bg-sidebar-accent/30 space-y-3 rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                        <div className="bg-sidebar flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border/70">
                            {selectedDirectory ? (
                                <FolderOpen className="size-4 text-sidebar-foreground" />
                            ) : (
                                <Folder className="size-4 text-sidebar-foreground/70" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium leading-none">Directory</p>
                            <p className="mt-1 break-all text-xs text-sidebar-foreground/70">
                                {directoryLabel}
                            </p>
                        </div>
                    </div>
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
