export type ArchitectureLayer = {
  name: string;
  description: string;
  examples: string[];
};

export function getFrontendArchitectureLayers(): ArchitectureLayer[] {
    return [
        {
            name: "layouts",
            description: "Reusable page shells and navigation composition.",
            examples: ["AppLayout", "DashboardLayout", "AuthLayout"],
        },
        {
            name: "pages",
            description: "Route-level screens assembled from feature components.",
            examples: ["HomePage", "SettingsPage", "BillingPage"],
        },
        {
            name: "components",
            description: "Reusable, mostly presentational UI blocks.",
            examples: ["LayerCard", "Input", "PrimaryButton"],
        },
        {
            name: "services",
            description: "Data access clients and application-side orchestration.",
            examples: ["AuthService", "UserService", "ProjectService"],
        },
    ];
}
