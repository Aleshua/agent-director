"use client";

import { Folder, FolderOpen } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
} from "@/frontend/components/ui/sidebar";
import {
    WORKSPACE_STATE_STORAGE_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

function subscribe(onStoreChange: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    function handleStorage(event: StorageEvent) {
        if (event.key !== WORKSPACE_STATE_STORAGE_KEY) {
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
    return workspaceStateService.getActiveWorkspace()?.directoryName ?? null;
}

function getServerSnapshot() {
    return null;
}

export function WorkspaceDirectoryPanel() {
    const selectedDirectory = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
