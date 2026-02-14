"use client";

import { FileText } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/frontend/components/ui/dialog";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import {
    getWorkspaceProjectDataSnapshot,
} from "@/frontend/services/workspace/workspace-project-data.service";
import {
    ACTIVE_WORKSPACE_ID_SESSION_KEY,
    WORKSPACE_STATE_STORAGE_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

type WorkspaceProjectDataSnapshot = ReturnType<typeof workspaceStateService.getActiveWorkspace>;

const SERVER_SNAPSHOT: WorkspaceProjectDataSnapshot = null;

let cachedClientSnapshot: WorkspaceProjectDataSnapshot = SERVER_SNAPSHOT;
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

export function WorkspaceProjectDataView() {
    const activeWorkspace = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

    const existingFiles = useMemo(() => {
        return getWorkspaceProjectDataSnapshot(activeWorkspace).files;
    }, [activeWorkspace]);
    const selectedFile = selectedFileName
        ? existingFiles.find((file) => file.name === selectedFileName) ?? null
        : null;

    if (!activeWorkspace) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold">Project Data</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {existingFiles.map((file) => (
                    <button
                        key={file.name}
                        type="button"
                        className="hover:bg-accent/40 focus-visible:ring-ring border-border/70 flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        onClick={() => setSelectedFileName(file.name)}
                    >
                        <FileText className="size-4 shrink-0" />
                        <span className="text-sm font-medium">{file.name}</span>
                    </button>
                ))}
            </div>

            <Dialog
                open={selectedFileName !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedFileName(null);
                    }
                }}
            >
                <DialogContent className="max-h-[85vh] sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{selectedFile?.name ?? "Project file"}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[58vh] rounded-md border border-border/70 bg-muted/30 p-3">
                        <pre className="text-xs leading-5 whitespace-pre-wrap break-words">
                            {selectedFile?.content && selectedFile.content.length > 0
                                ? selectedFile.content
                                : "(File is empty)"}
                        </pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
