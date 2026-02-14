"use client";

import type { WorkspaceAgentProvider } from "@/frontend/services/workspace/workspace-agent-file-search.service";
import type { WorkspaceRecord } from "@/frontend/services/workspace/workspace-state.service";
import { workspaceStateService } from "@/frontend/services/workspace/workspace-state.service";

export const WORKSPACE_PIPELINES_DATA_KEY = "pipelinesData";

export type PipelineStepStatus = "completed";
export type PipelineRunStatus = "completed";

export type WorkspacePipelineAgent = {
    id: string;
    label: string;
    provider: WorkspaceAgentProvider;
    filePath: string;
    description: string;
};

export type WorkspacePipelineStep = {
    id: string;
    agent: WorkspacePipelineAgent;
    createdAt: string;
};

export type WorkspacePipelineStepRun = {
    id: string;
    stepId: string;
    agent: WorkspacePipelineAgent;
    status: PipelineStepStatus;
    input: string;
    reasoningSummary: string;
    result: string;
    startedAt: string;
    finishedAt: string;
};

export type WorkspacePipelineRun = {
    id: string;
    pipelineId: string;
    status: PipelineRunStatus;
    task: string;
    startedAt: string;
    finishedAt: string;
    stepRuns: WorkspacePipelineStepRun[];
};

export type WorkspacePipeline = {
    id: string;
    name: string;
    steps: WorkspacePipelineStep[];
    runs: WorkspacePipelineRun[];
    createdAt: string;
    updatedAt: string;
};

export type WorkspacePipelinesSnapshot = {
    pipelines: WorkspacePipeline[];
};

const EMPTY_SNAPSHOT: WorkspacePipelinesSnapshot = { pipelines: [] };

const LEGACY_PIPELINE_AGENT_PRESETS = [
    {
        id: "claude-planner",
        label: "Planner",
        provider: "claude-code" as const,
        description: "Legacy preset: planner role.",
    },
    {
        id: "codex-senior",
        label: "Senior",
        provider: "codex" as const,
        description: "Legacy preset: implementation role.",
    },
    {
        id: "codex-reviewer",
        label: "Reviewer",
        provider: "codex" as const,
        description: "Legacy preset: review role.",
    },
] as const;

type LegacyPipelineAgentPreset = (typeof LEGACY_PIPELINE_AGENT_PRESETS)[number];
type LegacyPipelineAgentPresetId = LegacyPipelineAgentPreset["id"];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNowIso() {
    return new Date().toISOString();
}

function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizePipelineName(name: string) {
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : "Untitled pipeline";
}

function sanitizeTask(task: string) {
    const trimmed = task.trim();
    return trimmed.length > 0 ? trimmed : "No task provided.";
}

function compactText(value: string, maxLength = 420) {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength).trimEnd()}...`;
}

function getAgentProviderLabel(provider: WorkspaceAgentProvider) {
    return provider === "claude-code" ? "Claude Code" : "Codex";
}

function normalizeAgentProvider(value: unknown): WorkspaceAgentProvider | null {
    if (value === "claude-code" || value === "codex") {
        return value;
    }

    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "claude code" || normalized === "claude") {
        return "claude-code";
    }

    if (normalized === "codex") {
        return "codex";
    }

    return null;
}

function sanitizePipelineAgent(agent: WorkspacePipelineAgent): WorkspacePipelineAgent {
    const provider = normalizeAgentProvider(agent.provider) ?? "codex";
    const filePath = agent.filePath.trim().length > 0 ? agent.filePath.trim() : "unknown";
    const label = agent.label.trim().length > 0 ? agent.label.trim() : filePath;
    const id = agent.id.trim().length > 0 ? agent.id.trim() : `${provider}:${filePath}`;
    const description =
        agent.description.trim().length > 0
            ? agent.description.trim()
            : `${getAgentProviderLabel(provider)} agent from project.`;

    return {
        id,
        label,
        provider,
        filePath,
        description,
    };
}

function parseAgent(value: unknown): WorkspacePipelineAgent | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    if (
        typeof value.id !== "string" ||
        typeof value.label !== "string" ||
        typeof value.filePath !== "string" ||
        typeof value.description !== "string"
    ) {
        return null;
    }

    const provider = normalizeAgentProvider(value.provider);
    if (!provider) {
        return null;
    }

    return sanitizePipelineAgent({
        id: value.id,
        label: value.label,
        provider,
        filePath: value.filePath,
        description: value.description,
    });
}

function isLegacyPipelineAgentPresetId(value: unknown): value is LegacyPipelineAgentPresetId {
    return LEGACY_PIPELINE_AGENT_PRESETS.some((preset) => preset.id === value);
}

function getLegacyPresetById(presetId: LegacyPipelineAgentPresetId) {
    return LEGACY_PIPELINE_AGENT_PRESETS.find((preset) => preset.id === presetId) ?? LEGACY_PIPELINE_AGENT_PRESETS[0];
}

function createAgentFromLegacyPreset(presetId: LegacyPipelineAgentPresetId, legacyLabel?: string) {
    const preset = getLegacyPresetById(presetId);

    return sanitizePipelineAgent({
        id: `legacy:${preset.id}`,
        label: legacyLabel && legacyLabel.trim().length > 0 ? legacyLabel : preset.label,
        provider: preset.provider,
        filePath: `legacy/${preset.id}.md`,
        description: preset.description,
    });
}

function parseStep(value: unknown): WorkspacePipelineStep | null {
    if (!isObjectRecord(value) || typeof value.id !== "string" || typeof value.createdAt !== "string") {
        return null;
    }

    const parsedAgent = parseAgent(value.agent);
    if (parsedAgent) {
        return {
            id: value.id,
            agent: parsedAgent,
            createdAt: value.createdAt,
        };
    }

    if (isLegacyPipelineAgentPresetId(value.agentPresetId) && typeof value.agentLabel === "string") {
        return {
            id: value.id,
            agent: createAgentFromLegacyPreset(value.agentPresetId, value.agentLabel),
            createdAt: value.createdAt,
        };
    }

    return null;
}

function parseStepRun(value: unknown): WorkspacePipelineStepRun | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    if (
        typeof value.id !== "string" ||
        typeof value.stepId !== "string" ||
        value.status !== "completed" ||
        typeof value.input !== "string" ||
        typeof value.reasoningSummary !== "string" ||
        typeof value.result !== "string" ||
        typeof value.startedAt !== "string" ||
        typeof value.finishedAt !== "string"
    ) {
        return null;
    }

    const parsedAgent = parseAgent(value.agent);
    if (parsedAgent) {
        return {
            id: value.id,
            stepId: value.stepId,
            agent: parsedAgent,
            status: value.status,
            input: value.input,
            reasoningSummary: value.reasoningSummary,
            result: value.result,
            startedAt: value.startedAt,
            finishedAt: value.finishedAt,
        };
    }

    if (isLegacyPipelineAgentPresetId(value.agentPresetId) && typeof value.agentLabel === "string") {
        return {
            id: value.id,
            stepId: value.stepId,
            agent: createAgentFromLegacyPreset(value.agentPresetId, value.agentLabel),
            status: value.status,
            input: value.input,
            reasoningSummary: value.reasoningSummary,
            result: value.result,
            startedAt: value.startedAt,
            finishedAt: value.finishedAt,
        };
    }

    return null;
}

function parseRun(value: unknown): WorkspacePipelineRun | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    if (
        typeof value.id !== "string" ||
        typeof value.pipelineId !== "string" ||
        value.status !== "completed" ||
        typeof value.task !== "string" ||
        typeof value.startedAt !== "string" ||
        typeof value.finishedAt !== "string" ||
        !Array.isArray(value.stepRuns)
    ) {
        return null;
    }

    const stepRuns = value.stepRuns.map(parseStepRun).filter((run): run is WorkspacePipelineStepRun => {
        return run !== null;
    });

    return {
        id: value.id,
        pipelineId: value.pipelineId,
        status: value.status,
        task: value.task,
        startedAt: value.startedAt,
        finishedAt: value.finishedAt,
        stepRuns,
    };
}

function parsePipeline(value: unknown): WorkspacePipeline | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    if (
        typeof value.id !== "string" ||
        typeof value.name !== "string" ||
        typeof value.createdAt !== "string" ||
        typeof value.updatedAt !== "string" ||
        !Array.isArray(value.steps) ||
        !Array.isArray(value.runs)
    ) {
        return null;
    }

    const steps = value.steps.map(parseStep).filter((step): step is WorkspacePipelineStep => {
        return step !== null;
    });

    const runs = value.runs.map(parseRun).filter((run): run is WorkspacePipelineRun => {
        return run !== null;
    });

    return {
        id: value.id,
        name: value.name,
        steps,
        runs,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
}

function parsePipelinesSnapshot(value: unknown): WorkspacePipelinesSnapshot {
    if (!isObjectRecord(value) || !Array.isArray(value.pipelines)) {
        return EMPTY_SNAPSHOT;
    }

    const pipelines = value.pipelines
        .map(parsePipeline)
        .filter((pipeline): pipeline is WorkspacePipeline => pipeline !== null);

    return { pipelines };
}

function createStepFromAgent(agent: WorkspacePipelineAgent): WorkspacePipelineStep {
    return {
        id: createId(),
        agent: sanitizePipelineAgent(agent),
        createdAt: getNowIso(),
    };
}

function buildReasoningSummary({
    agent,
    task,
    previousOutput,
}: {
    agent: WorkspacePipelineAgent;
    task: string;
    previousOutput: string | null;
}) {
    const providerLabel = getAgentProviderLabel(agent.provider);
    const trimmedTask = compactText(task, 220);
    const previousSnippet = previousOutput ? compactText(previousOutput, 180) : "No prior step output.";

    return [
        `${providerLabel} agent \"${agent.label}\" analyzed task \"${trimmedTask}\".`,
        `Source file: ${agent.filePath}`,
        `Input context: ${previousSnippet}`,
    ].join("\n");
}

function buildAgentResult({
    agent,
    task,
    previousOutput,
}: {
    agent: WorkspacePipelineAgent;
    task: string;
    previousOutput: string | null;
}) {
    const providerLabel = getAgentProviderLabel(agent.provider);
    const normalizedTask = compactText(task, 200);
    const previousSnippet = previousOutput ? compactText(previousOutput, 260) : "No prior step output.";

    return [
        `${providerLabel} (${agent.label}) result for task: \"${normalizedTask}\"`,
        `Agent file: ${agent.filePath}`,
        `Notes: ${agent.description}`,
        `Previous step output:\n${previousSnippet}`,
        "Validation: run project checks in workspace after applying changes.",
    ].join("\n");
}

function updateWorkspacePipelines(
    workspaceId: string,
    updater: (snapshot: WorkspacePipelinesSnapshot) => WorkspacePipelinesSnapshot,
): WorkspacePipelinesSnapshot | null {
    const workspace = workspaceStateService
        .listWorkspaces()
        .find((candidate) => candidate.id === workspaceId);
    if (!workspace) {
        return null;
    }

    const currentSnapshot = parsePipelinesSnapshot(workspace.data[WORKSPACE_PIPELINES_DATA_KEY]);
    const nextSnapshot = updater(currentSnapshot);

    workspaceStateService.updateWorkspaceData(workspaceId, {
        [WORKSPACE_PIPELINES_DATA_KEY]: nextSnapshot,
    });

    return nextSnapshot;
}

export function getWorkspacePipelinesSnapshot(
    workspace: WorkspaceRecord | null,
): WorkspacePipelinesSnapshot {
    if (!workspace) {
        return EMPTY_SNAPSHOT;
    }

    return parsePipelinesSnapshot(workspace.data[WORKSPACE_PIPELINES_DATA_KEY]);
}

export function createWorkspacePipeline(
    workspaceId: string,
    pipelineName: string,
    initialAgents: WorkspacePipelineAgent[] = [],
): WorkspacePipeline | null {
    const now = getNowIso();
    const steps = initialAgents.slice(0, 2).map((agent) => createStepFromAgent(agent));

    const pipeline: WorkspacePipeline = {
        id: createId(),
        name: sanitizePipelineName(pipelineName),
        steps,
        runs: [],
        createdAt: now,
        updatedAt: now,
    };

    const updated = updateWorkspacePipelines(workspaceId, (snapshot) => ({
        pipelines: [...snapshot.pipelines, pipeline],
    }));

    if (!updated) {
        return null;
    }

    return pipeline;
}

export function renameWorkspacePipeline(
    workspaceId: string,
    pipelineId: string,
    pipelineName: string,
): WorkspacePipeline | null {
    const normalizedName = sanitizePipelineName(pipelineName);
    let updatedPipeline: WorkspacePipeline | null = null;

    updateWorkspacePipelines(workspaceId, (snapshot) => {
        const now = getNowIso();
        const pipelines = snapshot.pipelines.map((pipeline) => {
            if (pipeline.id !== pipelineId) {
                return pipeline;
            }

            const nextPipeline = {
                ...pipeline,
                name: normalizedName,
                updatedAt: now,
            };

            updatedPipeline = nextPipeline;
            return nextPipeline;
        });

        return { pipelines };
    });

    return updatedPipeline;
}

export function removeWorkspacePipeline(workspaceId: string, pipelineId: string) {
    let removed = false;

    updateWorkspacePipelines(workspaceId, (snapshot) => {
        const nextPipelines = snapshot.pipelines.filter((pipeline) => pipeline.id !== pipelineId);
        removed = nextPipelines.length !== snapshot.pipelines.length;
        return { pipelines: nextPipelines };
    });

    return removed;
}

export function addWorkspacePipelineStep(
    workspaceId: string,
    pipelineId: string,
    agent: WorkspacePipelineAgent,
): WorkspacePipeline | null {
    const newStep = createStepFromAgent(agent);
    let updatedPipeline: WorkspacePipeline | null = null;

    updateWorkspacePipelines(workspaceId, (snapshot) => {
        const now = getNowIso();
        const pipelines = snapshot.pipelines.map((pipeline) => {
            if (pipeline.id !== pipelineId) {
                return pipeline;
            }

            const nextPipeline = {
                ...pipeline,
                steps: [...pipeline.steps, newStep],
                updatedAt: now,
            };

            updatedPipeline = nextPipeline;
            return nextPipeline;
        });

        return { pipelines };
    });

    return updatedPipeline;
}

export function moveWorkspacePipelineStep(
    workspaceId: string,
    pipelineId: string,
    stepId: string,
    direction: "up" | "down",
): WorkspacePipeline | null {
    let updatedPipeline: WorkspacePipeline | null = null;

    updateWorkspacePipelines(workspaceId, (snapshot) => {
        const now = getNowIso();
        const pipelines = snapshot.pipelines.map((pipeline) => {
            if (pipeline.id !== pipelineId) {
                return pipeline;
            }

            const stepIndex = pipeline.steps.findIndex((step) => step.id === stepId);
            if (stepIndex < 0) {
                return pipeline;
            }

            const swapWithIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1;
            if (swapWithIndex < 0 || swapWithIndex >= pipeline.steps.length) {
                return pipeline;
            }

            const reorderedSteps = [...pipeline.steps];
            const [stepToMove] = reorderedSteps.splice(stepIndex, 1);
            reorderedSteps.splice(swapWithIndex, 0, stepToMove);

            const nextPipeline = {
                ...pipeline,
                steps: reorderedSteps,
                updatedAt: now,
            };

            updatedPipeline = nextPipeline;
            return nextPipeline;
        });

        return { pipelines };
    });

    return updatedPipeline;
}

export function removeWorkspacePipelineStep(
    workspaceId: string,
    pipelineId: string,
    stepId: string,
): WorkspacePipeline | null {
    let updatedPipeline: WorkspacePipeline | null = null;

    updateWorkspacePipelines(workspaceId, (snapshot) => {
        const now = getNowIso();
        const pipelines = snapshot.pipelines.map((pipeline) => {
            if (pipeline.id !== pipelineId) {
                return pipeline;
            }

            const steps = pipeline.steps.filter((step) => step.id !== stepId);
            if (steps.length === pipeline.steps.length) {
                return pipeline;
            }

            const nextPipeline = {
                ...pipeline,
                steps,
                updatedAt: now,
            };

            updatedPipeline = nextPipeline;
            return nextPipeline;
        });

        return { pipelines };
    });

    return updatedPipeline;
}

export function runWorkspacePipeline(
    workspaceId: string,
    pipelineId: string,
    task: string,
): WorkspacePipelineRun | null {
    const normalizedTask = sanitizeTask(task);
    let nextRun: WorkspacePipelineRun | null = null;

    updateWorkspacePipelines(workspaceId, (snapshot) => {
        const pipelines = snapshot.pipelines.map((pipeline) => {
            if (pipeline.id !== pipelineId || pipeline.steps.length === 0) {
                return pipeline;
            }

            const runStartedAt = getNowIso();
            let previousOutput: string | null = null;

            const stepRuns = pipeline.steps.map((step) => {
                const stepStartedAt = getNowIso();
                const input = previousOutput ?? normalizedTask;
                const reasoningSummary = buildReasoningSummary({
                    agent: step.agent,
                    task: normalizedTask,
                    previousOutput,
                });
                const result = buildAgentResult({
                    agent: step.agent,
                    task: normalizedTask,
                    previousOutput,
                });

                previousOutput = result;

                return {
                    id: createId(),
                    stepId: step.id,
                    agent: step.agent,
                    status: "completed" as const,
                    input,
                    reasoningSummary,
                    result,
                    startedAt: stepStartedAt,
                    finishedAt: getNowIso(),
                };
            });

            const runFinishedAt = getNowIso();
            const run: WorkspacePipelineRun = {
                id: createId(),
                pipelineId: pipeline.id,
                status: "completed",
                task: normalizedTask,
                startedAt: runStartedAt,
                finishedAt: runFinishedAt,
                stepRuns,
            };

            nextRun = run;

            return {
                ...pipeline,
                runs: [run, ...pipeline.runs].slice(0, 20),
                updatedAt: runFinishedAt,
            };
        });

        return { pipelines };
    });

    return nextRun;
}
