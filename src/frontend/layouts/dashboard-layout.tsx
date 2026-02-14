import type { ReactNode } from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
} from "@/frontend/components/ui/sidebar";

type DashboardLayoutProps = {
    sidebar: ReactNode;
    children: ReactNode;
};

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent>{sidebar}</SidebarContent>
            </Sidebar>
            <SidebarInset>
                <div className="px-6 py-8">
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                        <div>{children}</div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
