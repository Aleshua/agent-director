"use client";

export const LEGACY_SELECTED_DIRECTORY_STORAGE_KEY = "agent-director:selected-directory";
export const WORKSPACE_STATE_STORAGE_KEY = "agent-director:workspace-state:v1";
export const ACTIVE_WORKSPACE_ID_SESSION_KEY = "agent-director:active-workspace-id:v1";
export const WORKSPACE_STATE_CHANGED_EVENT = "agent-director:workspace-state-changed";

export type WorkspaceRecord = {
    id: string;
    directoryName: string;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

type WorkspaceStateSnapshot = {
    version: 1;
    workspaces: WorkspaceRecord[];
};

function isBrowserEnvironment() {
    return typeof window !== "undefined";
}

function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getNowIso() {
    return new Date().toISOString();
}

function getEmptyState(): WorkspaceStateSnapshot {
    return {
        version: 1,
        workspaces: [],
    };
}

function sanitizeDirectoryName(directoryName: string) {
    const trimmed = directoryName.trim();
    return trimmed.length > 0 ? trimmed : "Untitled workspace";
}

function isWorkspaceRecord(value: unknown): value is WorkspaceRecord {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<WorkspaceRecord>;
    return (
        typeof candidate.id === "string" &&
        typeof candidate.directoryName === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.updatedAt === "string" &&
        typeof candidate.data === "object" &&
        candidate.data !== null &&
        !Array.isArray(candidate.data)
    );
}

function parseState(rawValue: string | null): WorkspaceStateSnapshot {
    if (!rawValue) {
        return getEmptyState();
    }

    try {
        const parsed = JSON.parse(rawValue) as Partial<WorkspaceStateSnapshot>;
        const workspaces = Array.isArray(parsed.workspaces)
            ? parsed.workspaces.filter(isWorkspaceRecord)
            : [];

        return {
            version: 1,
            workspaces,
        };
    } catch {
        return getEmptyState();
    }
}

class WorkspaceStateService {
    private migrationChecked = false;

    listWorkspaces() {
        return [...this.readState().workspaces];
    }

    getActiveWorkspace() {
        const activeWorkspaceId = this.readActiveWorkspaceId();
        if (!activeWorkspaceId) {
            return null;
        }

        const state = this.readState();
        return state.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
    }

    selectWorkspaceByDirectoryName(directoryName: string) {
        const state = this.readState();
        const normalizedName = sanitizeDirectoryName(directoryName);
        const now = getNowIso();

        let workspace = state.workspaces.find((item) => item.directoryName === normalizedName);
        if (!workspace) {
            workspace = {
                id: createId(),
                directoryName: normalizedName,
                data: {},
                createdAt: now,
                updatedAt: now,
            };
            state.workspaces.push(workspace);
        } else {
            workspace.updatedAt = now;
        }

        this.writeState(state);
        this.writeActiveWorkspaceId(workspace.id);
        this.emitStateChanged();
        return workspace;
    }

    setActiveWorkspace(workspaceId: string) {
        const state = this.readState();
        const workspace = state.workspaces.find((item) => item.id === workspaceId);
        if (!workspace) {
            return null;
        }

        this.writeActiveWorkspaceId(workspace.id);
        this.emitStateChanged();
        return workspace;
    }

    clearActiveWorkspace() {
        if (!isBrowserEnvironment()) {
            return;
        }

        window.sessionStorage.removeItem(ACTIVE_WORKSPACE_ID_SESSION_KEY);
        this.emitStateChanged();
    }

    updateWorkspaceData(workspaceId: string, patch: Record<string, unknown>) {
        const state = this.readState();
        const workspace = state.workspaces.find((item) => item.id === workspaceId);
        if (!workspace) {
            return null;
        }

        workspace.data = {
            ...workspace.data,
            ...patch,
        };
        workspace.updatedAt = getNowIso();

        this.writeState(state);
        this.emitStateChanged();
        return workspace;
    }

    private readState() {
        this.migrateLegacySelectionIfNeeded();

        if (!isBrowserEnvironment()) {
            return getEmptyState();
        }

        return parseState(window.localStorage.getItem(WORKSPACE_STATE_STORAGE_KEY));
    }

    private writeState(state: WorkspaceStateSnapshot) {
        if (!isBrowserEnvironment()) {
            return;
        }

        window.localStorage.setItem(WORKSPACE_STATE_STORAGE_KEY, JSON.stringify(state));
    }

    private readActiveWorkspaceId() {
        if (!isBrowserEnvironment()) {
            return null;
        }

        return window.sessionStorage.getItem(ACTIVE_WORKSPACE_ID_SESSION_KEY);
    }

    private writeActiveWorkspaceId(workspaceId: string) {
        if (!isBrowserEnvironment()) {
            return;
        }

        window.sessionStorage.setItem(ACTIVE_WORKSPACE_ID_SESSION_KEY, workspaceId);
    }

    private migrateLegacySelectionIfNeeded() {
        if (this.migrationChecked || !isBrowserEnvironment()) {
            return;
        }

        this.migrationChecked = true;

        const legacyDirectoryName = window.localStorage.getItem(
            LEGACY_SELECTED_DIRECTORY_STORAGE_KEY,
        );
        if (!legacyDirectoryName) {
            return;
        }

        this.selectWorkspaceByDirectoryName(legacyDirectoryName);
        window.localStorage.removeItem(LEGACY_SELECTED_DIRECTORY_STORAGE_KEY);
    }

    private emitStateChanged() {
        if (!isBrowserEnvironment()) {
            return;
        }

        window.dispatchEvent(new Event(WORKSPACE_STATE_CHANGED_EVENT));
    }
}

export const workspaceStateService = new WorkspaceStateService();
