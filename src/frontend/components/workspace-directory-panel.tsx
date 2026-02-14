"use client";

import { Folder, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/frontend/components/ui/button";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
} from "@/frontend/components/ui/sidebar";

const STORAGE_KEY = "agent-director:selected-directory";

type DirectoryPickerWindow = Window & {
    showDirectoryPicker?: () => Promise<{ name: string }>;
};

export function WorkspaceDirectoryPanel() {
    const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
    const [isPicking, setIsPicking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const savedDirectory = window.localStorage.getItem(STORAGE_KEY);
        if (savedDirectory) {
            setSelectedDirectory(savedDirectory);
        }
    }, []);

    function clearSelection() {
        setSelectedDirectory(null);
        window.localStorage.removeItem(STORAGE_KEY);
    }

    async function handlePickDirectory() {
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
            setSelectedDirectory(handle.name);
            window.localStorage.setItem(STORAGE_KEY, handle.name);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            setErrorMessage("Failed to pick directory.");
        } finally {
            setIsPicking(false);
        }
    }

    const directoryLabel = selectedDirectory ?? "No directory selected";

    let pickerButtonLabel = "Select directory";
    if (isPicking) {
        pickerButtonLabel = "Opening picker...";
    } else if (selectedDirectory) {
        pickerButtonLabel = "Change directory";
    }

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

                    {errorMessage ? (
                        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-2 py-1 text-xs">
                            {errorMessage}
                        </p>
                    ) : null}

                    <div className="flex flex-col gap-2">
                        <Button
                            type="button"
                            size="sm"
                            className="w-full justify-start"
                            onClick={handlePickDirectory}
                            disabled={isPicking}
                        >
                            <FolderOpen className="size-4" />
                            {pickerButtonLabel}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-sidebar-border bg-transparent hover:bg-sidebar-accent w-full justify-start"
                            onClick={clearSelection}
                            disabled={!selectedDirectory || isPicking}
                        >
                            Clear selection
                        </Button>
                    </div>
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
