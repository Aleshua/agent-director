"use client";

import {
    ArrowDown,
    ArrowUp,
    Cable,
    Play,
    Plus,
    RefreshCcw,
    Save,
    Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/frontend/components/ui/accordion";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Input } from "@/frontend/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/frontend/components/ui/select";
import { Textarea } from "@/frontend/components/ui/textarea";
import {
    discoverWorkspaceDirectory,
    getWorkspaceDirectoryDiscoverySnapshot,
    type WorkspaceDiscoveredAgent,
} from "@/frontend/services/workspace/workspace-directory-discovery.service";
import {
    addWorkspacePipelineStep,
    createWorkspacePipeline,
    getWorkspacePipelinesSnapshot,
    moveWorkspacePipelineStep,
    removeWorkspacePipeline,
    removeWorkspacePipelineStep,
    renameWorkspacePipeline,
    runWorkspacePipeline,
    type WorkspacePipelineAgent,
} from "@/frontend/services/workspace/workspace-pipelines.service";
import {
    ACTIVE_WORKSPACE_ID_SESSION_KEY,
    WORKSPACE_STATE_STORAGE_KEY,
    WORKSPACE_STATE_CHANGED_EVENT,
    workspaceStateService,
} from "@/frontend/services/workspace/workspace-state.service";

type WorkspacePipelinesViewSnapshot = ReturnType<typeof workspaceStateService.getActiveWorkspace>;

const SERVER_SNAPSHOT: WorkspacePipelinesViewSnapshot = null;

let cachedClientSnapshot: WorkspacePipelinesViewSnapshot = SERVER_SNAPSHOT;
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

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatProviderLabel(provider: WorkspacePipelineAgent["provider"]) {
    return provider === "claude-code" ? "Claude Code" : "Codex";
}

function getAgentId(provider: WorkspacePipelineAgent["provider"], filePath: string) {
    return `${provider}:${filePath}`;
}

function getFileNameFromPath(filePath: string) {
    const normalized = filePath.replace(/\\/g, "/");
    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    return segments[segments.length - 1] ?? filePath;
}

function getConfidenceScore(confidence: WorkspaceDiscoveredAgent["confidence"]) {
    return confidence === "high" ? 2 : 1;
}

function mapDiscoveredAgentsToPipelineAgents(discoveredAgents: WorkspaceDiscoveredAgent[]) {
    const byAgentId = new Map<string, WorkspaceDiscoveredAgent>();

    for (const discoveredAgent of discoveredAgents) {
        if (discoveredAgent.filePath.trim().length === 0) {
            continue;
        }

        const agentId = getAgentId(discoveredAgent.provider, discoveredAgent.filePath);
        const existing = byAgentId.get(agentId);

        if (!existing) {
            byAgentId.set(agentId, discoveredAgent);
            continue;
        }

        if (getConfidenceScore(discoveredAgent.confidence) > getConfidenceScore(existing.confidence)) {
            byAgentId.set(agentId, discoveredAgent);
        }
    }

    return [...byAgentId.values()]
        .sort((left, right) => {
            const confidenceDiff = getConfidenceScore(right.confidence) - getConfidenceScore(left.confidence);
            if (confidenceDiff !== 0) {
                return confidenceDiff;
            }

            if (left.provider !== right.provider) {
                return left.provider.localeCompare(right.provider);
            }

            return left.filePath.localeCompare(right.filePath);
        })
        .map((discoveredAgent) => {
            const fileName = getFileNameFromPath(discoveredAgent.filePath);

            return {
                id: getAgentId(discoveredAgent.provider, discoveredAgent.filePath),
                label: fileName,
                provider: discoveredAgent.provider,
                filePath: discoveredAgent.filePath,
                description: discoveredAgent.reason,
            } satisfies WorkspacePipelineAgent;
        });
}

export function WorkspacePipelinesView() {
    const activeWorkspace = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const pipelinesSnapshot = useMemo(() => {
        return getWorkspacePipelinesSnapshot(activeWorkspace);
    }, [activeWorkspace]);

    const discoverySnapshot = useMemo(() => {
        return getWorkspaceDirectoryDiscoverySnapshot(activeWorkspace);
    }, [activeWorkspace]);

    const availableAgents = useMemo(() => {
        return mapDiscoveredAgentsToPipelineAgents(discoverySnapshot.discoveredAgents);
    }, [discoverySnapshot.discoveredAgents]);

    const [newPipelineName, setNewPipelineName] = useState("");
    const [selectedPipelineId, setSelectedPipelineId] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState("");
    const [pipelineNameDrafts, setPipelineNameDrafts] = useState<Record<string, string>>({});
    const [runTask, setRunTask] = useState("");
    const [isRefreshingAgents, setIsRefreshingAgents] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectedPipeline = useMemo(() => {
        if (pipelinesSnapshot.pipelines.length === 0) {
            return null;
        }

        const pipelineFromSelection = pipelinesSnapshot.pipelines.find(
            (pipeline) => pipeline.id === selectedPipelineId,
        );

        return pipelineFromSelection ?? pipelinesSnapshot.pipelines[0];
    }, [pipelinesSnapshot.pipelines, selectedPipelineId]);

    const pipelineNameDraft = selectedPipeline
        ? pipelineNameDrafts[selectedPipeline.id] ?? selectedPipeline.name
        : "";

    const selectedAgent = useMemo(() => {
        return availableAgents.find((agent) => agent.id === selectedAgentId) ?? null;
    }, [availableAgents, selectedAgentId]);

    useEffect(() => {
        if (availableAgents.length === 0) {
            setSelectedAgentId("");
            return;
        }

        if (!availableAgents.some((agent) => agent.id === selectedAgentId)) {
            setSelectedAgentId(availableAgents[0].id);
        }
    }, [availableAgents, selectedAgentId]);

    useEffect(() => {
        if (!activeWorkspace) {
            return;
        }

        const workspaceId = activeWorkspace.id;

        if (!workspaceStateService.hasWorkspaceDirectoryHandle(activeWorkspace.id)) {
            return;
        }

        if (discoverySnapshot.scannedAt) {
            return;
        }

        let cancelled = false;

        async function scanWorkspaceForAgents() {
            setIsRefreshingAgents(true);

            try {
                await discoverWorkspaceDirectory(workspaceId);
            } catch {
                if (!cancelled) {
                    setErrorMessage("Could not scan project for agents.");
                }
            } finally {
                if (!cancelled) {
                    setIsRefreshingAgents(false);
                }
            }
        }

        void scanWorkspaceForAgents();

        return () => {
            cancelled = true;
        };
    }, [activeWorkspace, discoverySnapshot.scannedAt]);

    async function handleRefreshAgents() {
        if (!activeWorkspace) {
            return;
        }

        const workspaceId = activeWorkspace.id;

        if (!workspaceStateService.hasWorkspaceDirectoryHandle(workspaceId)) {
            setErrorMessage("Project directory handle is not available for this workspace.");
            return;
        }

        setErrorMessage(null);
        setIsRefreshingAgents(true);

        try {
            await discoverWorkspaceDirectory(workspaceId);
        } catch {
            setErrorMessage("Could not refresh project agents.");
        } finally {
            setIsRefreshingAgents(false);
        }
    }

    function handleCreatePipeline() {
        if (!activeWorkspace) {
            return;
        }

        setErrorMessage(null);
        const pipeline = createWorkspacePipeline(activeWorkspace.id, newPipelineName, availableAgents);
        if (!pipeline) {
            setErrorMessage("Could not create pipeline.");
            return;
        }

        if (pipeline.steps.length === 0) {
            setErrorMessage("Pipeline created without steps. No project agents found yet.");
        }

        setNewPipelineName("");
        setSelectedPipelineId(pipeline.id);
        setPipelineNameDrafts((currentDrafts) => ({
            ...currentDrafts,
            [pipeline.id]: pipeline.name,
        }));
    }

    function handleRenamePipeline() {
        if (!activeWorkspace || !selectedPipeline) {
            return;
        }

        const updated = renameWorkspacePipeline(
            activeWorkspace.id,
            selectedPipeline.id,
            pipelineNameDraft,
        );
        if (!updated) {
            setErrorMessage("Could not rename pipeline.");
            return;
        }

        setErrorMessage(null);
        setPipelineNameDrafts((currentDrafts) => ({
            ...currentDrafts,
            [updated.id]: updated.name,
        }));
    }

    function handleDeletePipeline(pipelineId: string) {
        if (!activeWorkspace) {
            return;
        }

        const removed = removeWorkspacePipeline(activeWorkspace.id, pipelineId);
        if (!removed) {
            setErrorMessage("Could not remove pipeline.");
            return;
        }

        setErrorMessage(null);
    }

    function handleAddStep() {
        if (!activeWorkspace || !selectedPipeline) {
            return;
        }

        if (!selectedAgent) {
            setErrorMessage("Select a discovered project agent before adding a step.");
            return;
        }

        const updated = addWorkspacePipelineStep(
            activeWorkspace.id,
            selectedPipeline.id,
            selectedAgent,
        );
        if (!updated) {
            setErrorMessage("Could not add pipeline step.");
            return;
        }

        setErrorMessage(null);
    }

    function handleMoveStep(stepId: string, direction: "up" | "down") {
        if (!activeWorkspace || !selectedPipeline) {
            return;
        }

        const updated = moveWorkspacePipelineStep(
            activeWorkspace.id,
            selectedPipeline.id,
            stepId,
            direction,
        );
        if (!updated) {
            setErrorMessage("Could not reorder pipeline step.");
            return;
        }

        setErrorMessage(null);
    }

    function handleRemoveStep(stepId: string) {
        if (!activeWorkspace || !selectedPipeline) {
            return;
        }

        const updated = removeWorkspacePipelineStep(activeWorkspace.id, selectedPipeline.id, stepId);
        if (!updated) {
            setErrorMessage("Could not remove pipeline step.");
            return;
        }

        setErrorMessage(null);
    }

    function handleRunPipeline() {
        if (!activeWorkspace || !selectedPipeline) {
            return;
        }

        const run = runWorkspacePipeline(activeWorkspace.id, selectedPipeline.id, runTask);
        if (!run) {
            setErrorMessage("Could not run pipeline. Make sure it has at least one agent.");
            return;
        }

        setErrorMessage(null);
    }

    if (!activeWorkspace) {
        return (
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>Pipelines</CardTitle>
                    <CardDescription>Select a workspace to create and run pipelines.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Pipelines</h2>
                <p className="text-muted-foreground text-sm">
                    Create execution chains from agents discovered in project files.
                    Current run mode is local simulation.
                </p>
            </div>

            {errorMessage ? (
                <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
                    {errorMessage}
                </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
                <Card className="gap-4 py-4">
                    <CardHeader className="px-4">
                        <CardTitle className="text-base">Pipeline List</CardTitle>
                        <CardDescription>Create pipeline and choose one for editing.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 px-4">
                        <div className="space-y-2">
                            <Input
                                placeholder="New pipeline name"
                                value={newPipelineName}
                                onChange={(event) => {
                                    setNewPipelineName(event.target.value);
                                }}
                            />
                            <Button type="button" className="w-full" onClick={handleCreatePipeline}>
                                <Plus className="size-4" />
                                Create Pipeline
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {pipelinesSnapshot.pipelines.length === 0 ? (
                                <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                                    No pipelines yet.
                                </p>
                            ) : (
                                pipelinesSnapshot.pipelines.map((pipeline) => (
                                    <div
                                        key={pipeline.id}
                                        className="border-border/70 bg-background flex items-center gap-2 rounded-md border p-2"
                                    >
                                        <button
                                            type="button"
                                            className={`flex-1 rounded-sm px-2 py-1 text-left text-sm ${
                                                pipeline.id === selectedPipeline?.id
                                                    ? "bg-accent/60 text-accent-foreground font-medium"
                                                    : "text-foreground/80 hover:bg-accent/40"
                                            }`}
                                            onClick={() => {
                                                setSelectedPipelineId(pipeline.id);
                                            }}
                                        >
                                            <p className="truncate">{pipeline.name}</p>
                                            <p className="text-muted-foreground text-xs">
                                                {pipeline.steps.length} steps, {pipeline.runs.length} runs
                                            </p>
                                        </button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() => {
                                                handleDeletePipeline(pipeline.id);
                                            }}
                                            aria-label={`Delete ${pipeline.name}`}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="gap-4 py-4">
                    {!selectedPipeline ? (
                        <CardContent className="px-4">
                            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                                Select a pipeline to configure steps and run it.
                            </div>
                        </CardContent>
                    ) : (
                        <>
                            <CardHeader className="px-4">
                                <CardTitle className="text-base">Pipeline Editor</CardTitle>
                                <CardDescription>
                                    Configure which project agent goes first and inspect each handoff.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-6 px-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-medium">Pipeline name</p>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            value={pipelineNameDraft}
                                            onChange={(event) => {
                                                const nextName = event.target.value;
                                                setPipelineNameDrafts((currentDrafts) => ({
                                                    ...currentDrafts,
                                                    [selectedPipeline.id]: nextName,
                                                }));
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="sm:w-auto"
                                            onClick={handleRenamePipeline}
                                        >
                                            <Save className="size-4" />
                                            Save
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-medium">Agent chain</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{selectedPipeline.steps.length} steps</Badge>
                                            <Badge variant="outline">{availableAgents.length} discovered agents</Badge>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    void handleRefreshAgents();
                                                }}
                                                disabled={isRefreshingAgents}
                                            >
                                                <RefreshCcw className="size-3.5" />
                                                Refresh
                                            </Button>
                                        </div>
                                    </div>

                                    {selectedPipeline.steps.length === 0 ? (
                                        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                                            No steps yet. Add your first discovered agent below.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedPipeline.steps.map((step, index) => {
                                                return (
                                                    <div
                                                        key={step.id}
                                                        className="border-border/70 bg-muted/20 flex flex-wrap items-center gap-2 rounded-md border p-2"
                                                    >
                                                        <Badge variant="secondary">#{index + 1}</Badge>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-medium">
                                                                {step.agent.label}
                                                            </p>
                                                            <p className="text-muted-foreground truncate text-xs">
                                                                {formatProviderLabel(step.agent.provider)} - {step.agent.filePath}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            disabled={index === 0}
                                                            onClick={() => {
                                                                handleMoveStep(step.id, "up");
                                                            }}
                                                            aria-label={`Move ${step.agent.label} up`}
                                                        >
                                                            <ArrowUp className="size-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            disabled={index === selectedPipeline.steps.length - 1}
                                                            onClick={() => {
                                                                handleMoveStep(step.id, "down");
                                                            }}
                                                            aria-label={`Move ${step.agent.label} down`}
                                                        >
                                                            <ArrowDown className="size-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            onClick={() => {
                                                                handleRemoveStep(step.id);
                                                            }}
                                                            aria-label={`Remove ${step.agent.label}`}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="border-border/70 bg-background grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                        <Select
                                            value={selectedAgentId}
                                            onValueChange={(value: string) => {
                                                setSelectedAgentId(value);
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select discovered agent" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableAgents.length === 0 ? (
                                                    <SelectItem value="none" disabled>
                                                        No agents found
                                                    </SelectItem>
                                                ) : (
                                                    availableAgents.map((agent) => (
                                                        <SelectItem key={agent.id} value={agent.id}>
                                                            {formatProviderLabel(agent.provider)} / {agent.label}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleAddStep}
                                            disabled={!selectedAgent}
                                        >
                                            <Cable className="size-4" />
                                            Add Step
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-medium">Task for run</p>
                                    <Textarea
                                        value={runTask}
                                        placeholder="Describe what this pipeline should do..."
                                        onChange={(event) => {
                                            setRunTask(event.target.value);
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleRunPipeline}
                                        disabled={selectedPipeline.steps.length === 0}
                                    >
                                        <Play className="size-4" />
                                        Run Pipeline (Demo)
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs font-medium">Run history</p>

                                    {selectedPipeline.runs.length === 0 ? (
                                        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                                            No runs yet. Execute pipeline to see agent outputs.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedPipeline.runs.map((run) => (
                                                <div
                                                    key={run.id}
                                                    className="border-border/70 bg-background rounded-md border p-3"
                                                >
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <Badge>{run.status}</Badge>
                                                        <p className="text-muted-foreground text-xs">
                                                            Started {formatDateTime(run.startedAt)}
                                                        </p>
                                                    </div>

                                                    <p className="mb-3 text-sm font-medium">{run.task}</p>

                                                    <Accordion type="multiple" className="rounded-md border px-3">
                                                        {run.stepRuns.map((stepRun, index) => {
                                                            return (
                                                                <AccordionItem
                                                                    key={stepRun.id}
                                                                    value={stepRun.id}
                                                                >
                                                                    <AccordionTrigger>
                                                                        <div className="min-w-0 text-left">
                                                                            <p className="truncate">
                                                                                {index + 1}. {stepRun.agent.label}
                                                                            </p>
                                                                            <p className="text-muted-foreground truncate text-xs">
                                                                                {formatProviderLabel(stepRun.agent.provider)} - {stepRun.agent.filePath}
                                                                            </p>
                                                                        </div>
                                                                    </AccordionTrigger>
                                                                    <AccordionContent className="space-y-3">
                                                                        <div className="space-y-1">
                                                                            <p className="text-xs font-medium">
                                                                                Input
                                                                            </p>
                                                                            <pre className="bg-muted/50 overflow-x-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                                                                                {stepRun.input}
                                                                            </pre>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-xs font-medium">
                                                                                Thought process (summary)
                                                                            </p>
                                                                            <pre className="bg-muted/50 overflow-x-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                                                                                {stepRun.reasoningSummary}
                                                                            </pre>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-xs font-medium">
                                                                                Result
                                                                            </p>
                                                                            <pre className="bg-muted/50 overflow-x-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                                                                                {stepRun.result}
                                                                            </pre>
                                                                        </div>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            );
                                                        })}
                                                    </Accordion>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
