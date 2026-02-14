"use client";

import { useState } from "react";

import { WorkspaceDirectoryPanel } from "@/frontend/components/workspace-directory-panel";
import { WorkspacePipelinesButton } from "@/frontend/components/workspace-pipelines-button";
import { WorkspacePipelinesView } from "@/frontend/components/workspace-pipelines-view";
import { WorkspaceProjectDataButton } from "@/frontend/components/workspace-project-data-button";
import { WorkspaceProjectDataView } from "@/frontend/components/workspace-project-data-view";
import { WorkspaceSwitcher } from "@/frontend/components/workspace-switcher";
import { DashboardLayout } from "@/frontend/layouts/dashboard-layout";

type DashboardView = "pipelines" | "project-data";

export function Dashboard() {
    const [activeView, setActiveView] = useState<DashboardView>("pipelines");

    return (
        <DashboardLayout
            sidebar={
                <>
                    <WorkspaceDirectoryPanel />
                    <WorkspacePipelinesButton
                        isActive={activeView === "pipelines"}
                        onOpenPipelines={() => {
                            setActiveView("pipelines");
                        }}
                    />
                    <WorkspaceProjectDataButton
                        isActive={activeView === "project-data"}
                        onOpenProjectData={() => {
                            setActiveView("project-data");
                        }}
                    />
                </>
            }
            sidebarFooter={<WorkspaceSwitcher />}
        >
            {activeView === "pipelines" ? (
                <WorkspacePipelinesView />
            ) : (
                <WorkspaceProjectDataView />
            )}
        </DashboardLayout>
    );
}
