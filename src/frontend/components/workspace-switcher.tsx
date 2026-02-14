"use client";

import { Plus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/frontend/components/ui/sidebar";
import {
    ACTIVE_WORKSPACE_ID_SESSION_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    WORKSPACE_STATE_STORAGE_KEY,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

type WorkspaceSwitcherSnapshot = {
    workspaces: ReturnType<typeof workspaceStateService.listWorkspaces>;
    activeWorkspaceId: string;
};

type DirectoryPickerWindow = Window & {
    showDirectoryPicker?: () => Promise<{ name: string }>;
};

const SERVER_SNAPSHOT: WorkspaceSwitcherSnapshot = {
    workspaces: [],
    activeWorkspaceId: "",
};

let cachedClientSnapshot: WorkspaceSwitcherSnapshot = SERVER_SNAPSHOT;
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

function getSnapshot(): WorkspaceSwitcherSnapshot {
    const workspaces = workspaceStateService.listWorkspaces();
    const activeWorkspaceId = workspaceStateService.getActiveWorkspace()?.id ?? "";
    const signature = `${activeWorkspaceId}|${workspaces
        .map((workspace) => `${workspace.id}:${workspace.updatedAt}`)
        .join(",")}`;

    if (signature === cachedClientSignature) {
        return cachedClientSnapshot;
    }

    cachedClientSignature = signature;
    cachedClientSnapshot = {
        workspaces,
        activeWorkspaceId,
    };

    return cachedClientSnapshot;
}

function getServerSnapshot(): WorkspaceSwitcherSnapshot {
    return SERVER_SNAPSHOT;
}

export function WorkspaceSwitcher() {
    const { workspaces, activeWorkspaceId } = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );
    const [isPicking, setIsPicking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function handleAddWorkspace() {
        if (typeof window === "undefined") {
            return;
        }

        const pickerWindow = window as DirectoryPickerWindow;
        if (typeof pickerWindow.showDirectoryPicker !== "function") {
            setErrorMessage("Your browser does not support system directory picker.");
            return;
        }

        setIsPicking(true);
        setErrorMessage(null);

        try {
            const handle = await pickerWindow.showDirectoryPicker();
            workspaceStateService.selectWorkspaceByDirectoryName(handle.name);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            setErrorMessage("Failed to pick directory.");
        } finally {
            setIsPicking(false);
        }
    }

    function handleActivateWorkspace(workspaceId: string) {
        workspaceStateService.setActiveWorkspace(workspaceId);
    }

    function handleRemoveWorkspace(workspaceId: string) {
        workspaceStateService.removeWorkspace(workspaceId);
    }

    return (
        <SidebarGroup className="gap-2">
            <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
            <SidebarGroupAction
                type="button"
                onClick={handleAddWorkspace}
                disabled={isPicking}
                title="Add workspace"
            >
                <Plus />
            </SidebarGroupAction>

            <SidebarGroupContent>
                {errorMessage ? (
                    <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-2 py-1 text-xs">
                        {errorMessage}
                    </p>
                ) : null}

                {workspaces.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-sidebar-foreground/60">
                        No workspaces yet. Click +
                    </p>
                ) : (
                    <SidebarMenu className="max-h-[104px] overflow-y-auto">
                        {workspaces.map((workspace) => (
                            <SidebarMenuItem key={workspace.id}>
                                <SidebarMenuButton
                                    type="button"
                                    isActive={workspace.id === activeWorkspaceId}
                                    onClick={() => handleActivateWorkspace(workspace.id)}
                                    title={workspace.directoryName}
                                >
                                    <span>{workspace.directoryName}</span>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    type="button"
                                    showOnHover
                                    onClick={() => handleRemoveWorkspace(workspace.id)}
                                    aria-label={`Close workspace ${workspace.directoryName}`}
                                    title="Close workspace"
                                >
                                    <X />
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
