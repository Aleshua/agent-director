import { WorkspaceDirectoryCard } from "@/frontend/components/workspace-directory-card";
import { AppLayout } from "@/frontend/layouts/app-layout";

export function HomePage() {
    return (
        <AppLayout
            title="Agent Director"
            subtitle="Configure the working directory for your local agents."
        >
            <WorkspaceDirectoryCard />
        </AppLayout>
    );
}
