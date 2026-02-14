type LayerCardProps = {
  title: string;
  description: string;
  items: string[];
};

export function LayerCard({ title, description, items }: LayerCardProps) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {items.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-100 px-3 py-2">
                        {item}
                    </li>
                ))}
            </ul>
        </article>
    );
}
