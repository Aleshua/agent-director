import { WorkspaceDirectoryPanel } from "@/frontend/components/workspace-directory-panel";
import { WorkspaceSwitcher } from "@/frontend/components/workspace-switcher";
import { DashboardLayout } from "@/frontend/layouts/dashboard-layout";

export function Dashboard() {
    return (
        <DashboardLayout
            sidebar={<WorkspaceDirectoryPanel />}
            sidebarFooter={<WorkspaceSwitcher />}
        >
            <>
            </>
        </DashboardLayout>
    );
}
