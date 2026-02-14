"use client";

import { useSyncExternalStore, type ChangeEvent } from "react";

import {
    ACTIVE_WORKSPACE_ID_SESSION_KEY,
    WORKSPACE_STATE_STORAGE_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

type WorkspaceSwitcherSnapshot = {
    workspaces: ReturnType<typeof workspaceStateService.listWorkspaces>;
    activeWorkspaceId: string;
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

    function handleWorkspaceSwitch(event: ChangeEvent<HTMLSelectElement>) {
        const workspaceId = event.target.value;
        if (!workspaceId) {
            workspaceStateService.clearActiveWorkspace();
            return;
        }

        workspaceStateService.setActiveWorkspace(workspaceId);
    }

    return (
        <div className="border-sidebar-border/70 bg-sidebar-accent/30 rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-sidebar-foreground/70">Workspaces</p>
            <select
                className="border-sidebar-border bg-sidebar h-9 w-full rounded-md border px-2 text-xs"
                value={activeWorkspaceId}
                onChange={handleWorkspaceSwitch}
                disabled={workspaces.length === 0}
            >
                <option value="">
                    {workspaces.length === 0 ? "No workspaces yet" : "No active workspace"}
                </option>
                {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                        {workspace.directoryName}
                    </option>
                ))}
            </select>
        </div>
    );
}
