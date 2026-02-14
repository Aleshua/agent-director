"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/frontend/components/ui/button";
import { SidebarGroup, SidebarGroupContent } from "@/frontend/components/ui/sidebar";
import {
    ACTIVE_WORKSPACE_ID_SESSION_KEY,
    WORKSPACE_STATE_STORAGE_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

type WorkspacePipelinesButtonProps = {
    onOpenPipelines: () => void;
    isActive?: boolean;
};

type WorkspacePipelinesButtonSnapshot = ReturnType<typeof workspaceStateService.getActiveWorkspace>;

const SERVER_SNAPSHOT: WorkspacePipelinesButtonSnapshot = null;

let cachedClientSnapshot: WorkspacePipelinesButtonSnapshot = SERVER_SNAPSHOT;
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

export function WorkspacePipelinesButton({ onOpenPipelines, isActive }: WorkspacePipelinesButtonProps) {
    const activeWorkspace = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return (
        <SidebarGroup className="pt-0">
            <SidebarGroupContent>
                <Button
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    className="w-full"
                    disabled={!activeWorkspace}
                    onClick={onOpenPipelines}
                >
                    Open Pipelines
                </Button>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
