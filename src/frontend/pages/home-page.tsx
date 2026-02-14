"use client";

import { useState } from "react";

import { WorkspaceDirectoryPanel } from "@/frontend/components/workspace-directory-panel";
import { WorkspaceProjectDataButton } from "@/frontend/components/workspace-project-data-button";
import { WorkspaceProjectDataView } from "@/frontend/components/workspace-project-data-view";
import { WorkspaceSwitcher } from "@/frontend/components/workspace-switcher";
import { DashboardLayout } from "@/frontend/layouts/dashboard-layout";

export function Dashboard() {
    const [isProjectDataOpen, setProjectDataOpen] = useState(false);

    return (
        <DashboardLayout
            sidebar={
                <>
                    <WorkspaceDirectoryPanel />
                    <WorkspaceProjectDataButton
                        onOpenProjectData={() => {
                            setProjectDataOpen(true);
                        }}
                    />
                </>
            }
            sidebarFooter={<WorkspaceSwitcher />}
        >
            {isProjectDataOpen ? (
                <WorkspaceProjectDataView />
            ) : null}
        </DashboardLayout>
    );
}
