"use client";

export const DEFAULT_AGENT_FILE_NAMES = ["AGENT.md", "AGENTS.md", "CLAUDE.md", "CODEX.md"] as const;
export const DEFAULT_AGENT_PATH_TOKENS = ["agents", "claude", "codex"] as const;

export type WorkspaceAgentProvider = "claude-code" | "codex";

export type WorkspaceAgentFinding = {
    provider: WorkspaceAgentProvider;
    confidence: "high" | "medium";
    filePath: string;
    reason: string;
    snippet: string | null;
};

export function normalizeWorkspaceSearchValue(value: string) {
    return value.trim().toLowerCase();
}

export function compactWorkspaceTextSnippet(text: string, maxLength = 220) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed.length === 0) {
        return null;
    }

    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trimEnd()}...` : trimmed;
}

export function createCaseInsensitiveFileNameCandidates(fileName: string) {
    const titleCaseName =
        fileName.length > 0 ? `${fileName.slice(0, 1)}${fileName.slice(1).toLowerCase()}` : fileName;

    return Array.from(
        new Set([fileName, fileName.toLowerCase(), fileName.toUpperCase(), titleCaseName]),
    );
}

export async function findFirstFileHandleByName(
    directoryHandle: FileSystemDirectoryHandle,
    fileNames: readonly string[],
) {
    for (const fileName of fileNames) {
        const candidateNames = createCaseInsensitiveFileNameCandidates(fileName);

        for (const candidateName of candidateNames) {
            try {
                const fileHandle = await directoryHandle.getFileHandle(candidateName);
                return {
                    matchedName: fileName,
                    fileHandle,
                };
            } catch (error) {
                if (error instanceof DOMException && error.name === "NotFoundError") {
                    continue;
                }

                throw error;
            }
        }
    }

    return null;
}

export function isLikelyAgentTextFile(fileName: string) {
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".md") || lower.endsWith(".txt")) {
        return true;
    }

    if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml")) {
        return true;
    }

    return lower.includes("agent") || lower.includes("claude") || lower.includes("codex");
}

export function detectAgentByPathOrFileName(path: string, fileName: string) {
    const normalizedPath = normalizeWorkspaceSearchValue(path);
    const normalizedFileName = normalizeWorkspaceSearchValue(fileName);
    const findings: WorkspaceAgentFinding[] = [];

    if (
        normalizedFileName === "claude.md" ||
        normalizedPath.includes("/.claude/") ||
        normalizedPath.includes("claude")
    ) {
        findings.push({
            provider: "claude-code",
            confidence: "high",
            filePath: path,
            reason: "Path or file name indicates Claude Code configuration.",
            snippet: null,
        });
    }

    if (
        normalizedFileName === "agent.md" ||
        normalizedFileName === "agents.md" ||
        normalizedFileName === "codex.md" ||
        normalizedPath.includes("/.codex/") ||
        normalizedPath.includes("codex")
    ) {
        findings.push({
            provider: "codex",
            confidence: "high",
            filePath: path,
            reason: "Path or file name indicates Codex configuration.",
            snippet: null,
        });
    }

    return findings;
}

export function detectAgentByContent(path: string, text: string) {
    const normalized = text.toLowerCase();
    const findings: WorkspaceAgentFinding[] = [];

    if (normalized.includes("claude code") || normalized.includes("anthropic")) {
        findings.push({
            provider: "claude-code",
            confidence: "medium",
            filePath: path,
            reason: "File content references Claude Code.",
            snippet: compactWorkspaceTextSnippet(text),
        });
    }

    if (normalized.includes("codex") || normalized.includes("openai")) {
        findings.push({
            provider: "codex",
            confidence: "medium",
            filePath: path,
            reason: "File content references Codex.",
            snippet: compactWorkspaceTextSnippet(text),
        });
    }

    return findings;
}

export function addAgentFindingIfMissing(
    collection: WorkspaceAgentFinding[],
    candidate: WorkspaceAgentFinding,
) {
    const duplicateExists = collection.some((item) => {
        return (
            item.provider === candidate.provider &&
            item.filePath === candidate.filePath &&
            item.reason === candidate.reason
        );
    });

    if (!duplicateExists) {
        collection.push(candidate);
    }
}
