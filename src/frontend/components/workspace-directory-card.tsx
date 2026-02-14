"use client";

import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/components/ui/card";

const STORAGE_KEY = "agent-director:selected-directory";

type DirectoryPickerWindow = Window & {
    showDirectoryPicker?: () => Promise<{ name: string }>;
};

export function WorkspaceDirectoryCard() {
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Working Directory</CardTitle>
                <CardDescription>Pick a local folder for your agents.</CardDescription>
            </CardHeader>

            <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={handlePickDirectory} disabled={isPicking}>
                        <FolderOpen className="size-4" />
                        {isPicking ? "Opening..." : "Select Directory"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={clearSelection}
                        disabled={!selectedDirectory || isPicking}
                    >
                        Clear
                    </Button>
                    <span className="text-sm text-slate-600">
                        {selectedDirectory ? `Selected: ${selectedDirectory}` : "No directory selected"}
                    </span>
                </div>

                {errorMessage ? <p className="mt-2 text-sm text-rose-700">{errorMessage}</p> : null}
            </CardContent>
        </Card>
    );
}
