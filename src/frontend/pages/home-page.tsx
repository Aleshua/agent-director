import { LayerCard } from "@/frontend/components/layer-card";
import { AppLayout } from "@/frontend/layouts/app-layout";
import { getFrontendArchitectureLayers } from "@/frontend/services/architecture.service";

export function HomePage() {
    const layers = getFrontendArchitectureLayers();

    return (
        <AppLayout
            title="Fullstack Project Structure"
            subtitle="Frontend and backend are split into clear layers for scale and ownership."
        >
            <section className="grid gap-4 md:grid-cols-2">
                {layers.map((layer) => (
                    <LayerCard
                        key={layer.name}
                        title={layer.name}
                        description={layer.description}
                        items={layer.examples}
                    />
                ))}
            </section>
        </AppLayout>
    );
}
