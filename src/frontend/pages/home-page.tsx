import { WorkspaceDirectoryPanel } from "@/frontend/components/workspace-directory-panel";
import { DashboardLayout } from "@/frontend/layouts/dashboard-layout";

export function Dashboard() {
    return (
        <DashboardLayout sidebar={<WorkspaceDirectoryPanel />}>
            <>
            </>
        </DashboardLayout>
    );
}
