"use client";

import type { WorkspaceRecord } from "@/frontend/services/workspace/workspace-state.service";
import { findFirstFileHandleByName } from "@/frontend/services/workspace/workspace-agent-file-search.service";
import { workspaceStateService } from "@/frontend/services/workspace/workspace-state.service";

export const WORKSPACE_PROJECT_DATA_KEY = "projectData";
export const PROJECT_DATA_FILE_NAMES = ["AGENTS.md", "CLAUDE.md"] as const;

export type ProjectDataFileName = (typeof PROJECT_DATA_FILE_NAMES)[number];

export type ProjectDataFile = {
    name: ProjectDataFileName;
    content: string;
};

export type WorkspaceProjectDataSnapshot = {
    files: ProjectDataFile[];
};

const PROJECT_DATA_FILE_SEARCH_NAMES: Record<ProjectDataFileName, readonly string[]> = {
    "AGENTS.md": ["AGENTS.md", "AGENT.md"],
    "CLAUDE.md": ["CLAUDE.md"],
};

function createEmptySnapshot(): WorkspaceProjectDataSnapshot {
    return { files: [] };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectDataFileName(value: unknown): value is ProjectDataFileName {
    return value === "AGENTS.md" || value === "CLAUDE.md";
}

function parseWorkspaceProjectDataSnapshot(value: unknown): WorkspaceProjectDataSnapshot {
    if (!isObjectRecord(value)) {
        return createEmptySnapshot();
    }

    const parsedFiles: ProjectDataFile[] = [];
    const rawFiles = value.files;

    if (Array.isArray(rawFiles)) {
        for (const item of rawFiles) {
            if (!isObjectRecord(item)) {
                continue;
            }

            if (!isProjectDataFileName(item.name) || typeof item.content !== "string") {
                continue;
            }

            parsedFiles.push({
                name: item.name,
                content: item.content,
            });
        }

        return { files: parsedFiles };
    }

    // Backward compatibility: previous snapshot shape was an object keyed by file names.
    if (isObjectRecord(rawFiles)) {
        for (const fileName of PROJECT_DATA_FILE_NAMES) {
            const entry = rawFiles[fileName];
            if (!isObjectRecord(entry) || typeof entry.content !== "string") {
                continue;
            }

            parsedFiles.push({
                name: fileName,
                content: entry.content,
            });
        }

        return { files: parsedFiles };
    }

    return createEmptySnapshot();
}

export function getWorkspaceProjectDataSnapshot(
    workspace: WorkspaceRecord | null,
): WorkspaceProjectDataSnapshot {
    if (!workspace) {
        return createEmptySnapshot();
    }

    return parseWorkspaceProjectDataSnapshot(workspace.data[WORKSPACE_PROJECT_DATA_KEY]);
}

export async function readWorkspaceProjectDataSnapshot(
    directoryHandle: FileSystemDirectoryHandle,
): Promise<WorkspaceProjectDataSnapshot> {
    const files: ProjectDataFile[] = [];

    for (const fileName of PROJECT_DATA_FILE_NAMES) {
        const match = await findFirstFileHandleByName(
            directoryHandle,
            PROJECT_DATA_FILE_SEARCH_NAMES[fileName],
        );
        if (!match) {
            continue;
        }

        const file = await match.fileHandle.getFile();
        files.push({
            name: fileName,
            content: await file.text(),
        });
    }

    return { files };
}

export async function refreshWorkspaceProjectData(workspaceId: string) {
    const directoryHandle = workspaceStateService.getWorkspaceDirectoryHandle(workspaceId);
    if (!directoryHandle) {
        return null;
    }

    const snapshot = await readWorkspaceProjectDataSnapshot(directoryHandle);
    workspaceStateService.updateWorkspaceData(workspaceId, {
        [WORKSPACE_PROJECT_DATA_KEY]: snapshot,
    });

    return snapshot;
}
