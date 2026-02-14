"use client";

import type { WorkspaceRecord } from "@/frontend/services/workspace/workspace-state.service";
import {
    addAgentFindingIfMissing,
    DEFAULT_AGENT_FILE_NAMES,
    DEFAULT_AGENT_PATH_TOKENS,
    detectAgentByContent,
    detectAgentByPathOrFileName,
    isLikelyAgentTextFile,
    normalizeWorkspaceSearchValue,
    type WorkspaceAgentFinding,
} from "@/frontend/services/workspace/workspace-agent-file-search.service";
import { workspaceStateService } from "@/frontend/services/workspace/workspace-state.service";

export const WORKSPACE_DIRECTORY_DISCOVERY_DATA_KEY = "directoryDiscovery";

export const DEFAULT_REQUIRED_FILE_NAMES = [...DEFAULT_AGENT_FILE_NAMES];

export type WorkspaceDiscoveredFile = {
    name: string;
    path: string;
    size: number;
    lastModified: number;
    matchedBy: "required-file-name" | "path-token";
};

export type WorkspaceDiscoveredAgent = WorkspaceAgentFinding;

export type WorkspaceDirectoryDiscoverySnapshot = {
    scannedAt: string;
    discoveredFiles: WorkspaceDiscoveredFile[];
    discoveredAgents: WorkspaceDiscoveredAgent[];
};

type DiscoverWorkspaceDirectoryOptions = {
    requiredFileNames?: string[];
    pathTokens?: string[];
    maxDepth?: number;
    maxFiles?: number;
    maxTextFileSizeBytes?: number;
};

type TraversedFile = {
    name: string;
    path: string;
    fileHandle: FileSystemFileHandle;
};

type DirectoryEntriesReader = {
    entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

const EMPTY_SNAPSHOT: WorkspaceDirectoryDiscoverySnapshot = {
    scannedAt: "",
    discoveredFiles: [],
    discoveredAgents: [],
};

const DEFAULT_PATH_TOKENS = [...DEFAULT_AGENT_PATH_TOKENS];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowIso() {
    return new Date().toISOString();
}

function parseDiscoveredFile(value: unknown): WorkspaceDiscoveredFile | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    if (
        typeof value.name !== "string" ||
        typeof value.path !== "string" ||
        typeof value.size !== "number" ||
        typeof value.lastModified !== "number" ||
        (value.matchedBy !== "required-file-name" && value.matchedBy !== "path-token")
    ) {
        return null;
    }

    return {
        name: value.name,
        path: value.path,
        size: value.size,
        lastModified: value.lastModified,
        matchedBy: value.matchedBy,
    };
}

function parseDiscoveredAgent(value: unknown): WorkspaceDiscoveredAgent | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    if (
        (value.provider !== "claude-code" && value.provider !== "codex") ||
        (value.confidence !== "high" && value.confidence !== "medium") ||
        typeof value.filePath !== "string" ||
        typeof value.reason !== "string" ||
        (value.snippet !== null && typeof value.snippet !== "string")
    ) {
        return null;
    }

    return {
        provider: value.provider,
        confidence: value.confidence,
        filePath: value.filePath,
        reason: value.reason,
        snippet: value.snippet,
    };
}

function parseDirectoryDiscoverySnapshot(value: unknown): WorkspaceDirectoryDiscoverySnapshot {
    if (!isObjectRecord(value)) {
        return EMPTY_SNAPSHOT;
    }

    let discoveredFiles: WorkspaceDiscoveredFile[] = [];
    if (Array.isArray(value.discoveredFiles)) {
        discoveredFiles = value.discoveredFiles
            .map(parseDiscoveredFile)
            .filter((item): item is WorkspaceDiscoveredFile => item !== null);
    }

    let discoveredAgents: WorkspaceDiscoveredAgent[] = [];
    if (Array.isArray(value.discoveredAgents)) {
        discoveredAgents = value.discoveredAgents
            .map(parseDiscoveredAgent)
            .filter((item): item is WorkspaceDiscoveredAgent => item !== null);
    }

    return {
        scannedAt: typeof value.scannedAt === "string" ? value.scannedAt : "",
        discoveredFiles,
        discoveredAgents,
    };
}

async function collectDirectoryFiles({
    directoryHandle,
    maxDepth,
    maxFiles,
}: {
    directoryHandle: FileSystemDirectoryHandle;
    maxDepth: number;
    maxFiles: number;
}): Promise<TraversedFile[]> {
    const files: TraversedFile[] = [];

    async function walkDirectory(handle: FileSystemDirectoryHandle, parentPath: string, depth: number) {
        if (files.length >= maxFiles || depth > maxDepth) {
            return;
        }

        const entriesReader = handle as unknown as DirectoryEntriesReader;

        for await (const [entryName, entry] of entriesReader.entries()) {
            if (files.length >= maxFiles) {
                return;
            }

            const nextPath = parentPath ? `${parentPath}/${entryName}` : entryName;

            if (entry.kind === "file") {
                files.push({
                    name: entryName,
                    path: nextPath,
                    fileHandle: entry as FileSystemFileHandle,
                });
                continue;
            }

            if (depth < maxDepth) {
                await walkDirectory(entry as FileSystemDirectoryHandle, nextPath, depth + 1);
            }
        }
    }

    await walkDirectory(directoryHandle, "", 0);
    return files;
}

async function findRequiredFilesAndAgents({
    directoryHandle,
    requiredFileNames,
    pathTokens,
    maxDepth,
    maxFiles,
    maxTextFileSizeBytes,
}: {
    directoryHandle: FileSystemDirectoryHandle;
    requiredFileNames: string[];
    pathTokens: string[];
    maxDepth: number;
    maxFiles: number;
    maxTextFileSizeBytes: number;
}) {
    const normalizedRequiredNames = new Set(requiredFileNames.map(normalizeWorkspaceSearchValue));
    const normalizedPathTokens = pathTokens
        .map(normalizeWorkspaceSearchValue)
        .filter((token) => token.length > 0);
    const traversedFiles = await collectDirectoryFiles({
        directoryHandle,
        maxDepth,
        maxFiles,
    });

    const discoveredFiles: WorkspaceDiscoveredFile[] = [];
    const discoveredAgents: WorkspaceDiscoveredAgent[] = [];
    const fileMatchPathSet = new Set<string>();

    for (const traversedFile of traversedFiles) {
        const normalizedName = normalizeWorkspaceSearchValue(traversedFile.name);
        const normalizedPath = normalizeWorkspaceSearchValue(traversedFile.path);
        const matchesRequiredFileName = normalizedRequiredNames.has(normalizedName);
        const matchedToken = normalizedPathTokens.find((token) => normalizedPath.includes(token)) ?? null;

        const shouldInspectFile =
            matchesRequiredFileName || matchedToken !== null || isLikelyAgentTextFile(traversedFile.name);

        if (!shouldInspectFile) {
            continue;
        }

        let file: File | null = null;
        try {
            file = await traversedFile.fileHandle.getFile();
        } catch {
            continue;
        }

        if (matchesRequiredFileName && !fileMatchPathSet.has(traversedFile.path)) {
            discoveredFiles.push({
                name: traversedFile.name,
                path: traversedFile.path,
                size: file.size,
                lastModified: file.lastModified,
                matchedBy: "required-file-name",
            });
            fileMatchPathSet.add(traversedFile.path);
        }

        if (!matchesRequiredFileName && matchedToken !== null && !fileMatchPathSet.has(traversedFile.path)) {
            discoveredFiles.push({
                name: traversedFile.name,
                path: traversedFile.path,
                size: file.size,
                lastModified: file.lastModified,
                matchedBy: "path-token",
            });
            fileMatchPathSet.add(traversedFile.path);
        }

        for (const finding of detectAgentByPathOrFileName(traversedFile.path, traversedFile.name)) {
            addAgentFindingIfMissing(discoveredAgents, finding);
        }

        if (!isLikelyAgentTextFile(traversedFile.name) || file.size > maxTextFileSizeBytes) {
            continue;
        }

        let textContent = "";
        try {
            textContent = await file.text();
        } catch {
            continue;
        }

        for (const finding of detectAgentByContent(traversedFile.path, textContent)) {
            addAgentFindingIfMissing(discoveredAgents, finding);
        }
    }

    return {
        discoveredFiles,
        discoveredAgents,
    };
}

export function getWorkspaceDirectoryDiscoverySnapshot(
    workspace: WorkspaceRecord | null,
): WorkspaceDirectoryDiscoverySnapshot {
    if (!workspace) {
        return EMPTY_SNAPSHOT;
    }

    return parseDirectoryDiscoverySnapshot(workspace.data[WORKSPACE_DIRECTORY_DISCOVERY_DATA_KEY]);
}

export async function discoverWorkspaceDirectory(
    workspaceId: string,
    options: DiscoverWorkspaceDirectoryOptions = {},
) {
    const directoryHandle = workspaceStateService.getWorkspaceDirectoryHandle(workspaceId);
    if (!directoryHandle) {
        return null;
    }

    const requiredFileNames = options.requiredFileNames ?? [...DEFAULT_REQUIRED_FILE_NAMES];
    const pathTokens = options.pathTokens ?? [...DEFAULT_PATH_TOKENS];
    const maxDepth = options.maxDepth ?? 10;
    const maxFiles = options.maxFiles ?? 5000;
    const maxTextFileSizeBytes = options.maxTextFileSizeBytes ?? 400_000;

    const discovery = await findRequiredFilesAndAgents({
        directoryHandle,
        requiredFileNames,
        pathTokens,
        maxDepth,
        maxFiles,
        maxTextFileSizeBytes,
    });

    const snapshot: WorkspaceDirectoryDiscoverySnapshot = {
        scannedAt: nowIso(),
        discoveredFiles: discovery.discoveredFiles,
        discoveredAgents: discovery.discoveredAgents,
    };

    workspaceStateService.updateWorkspaceData(workspaceId, {
        [WORKSPACE_DIRECTORY_DISCOVERY_DATA_KEY]: snapshot,
    });

    return snapshot;
}

export async function findWorkspaceFiles(
    workspaceId: string,
    options: DiscoverWorkspaceDirectoryOptions = {},
) {
    const snapshot = await discoverWorkspaceDirectory(workspaceId, options);
    if (!snapshot) {
        return null;
    }

    return snapshot.discoveredFiles;
}

export async function findWorkspaceAgents(
    workspaceId: string,
    options: DiscoverWorkspaceDirectoryOptions = {},
) {
    const snapshot = await discoverWorkspaceDirectory(workspaceId, options);
    if (!snapshot) {
        return null;
    }

    return snapshot.discoveredAgents;
}
