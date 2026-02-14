import type { ReactNode } from "react";

type AppLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                    {subtitle ? (
                        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
                    ) : null}
                </header>
                <main>{children}</main>
            </div>
        </div>
    );
}
