import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ApiCategory {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface ApiItem {
  id: string;
  name: string;
  price: string;
  categoryId: string;
  isActive: boolean;
  sortOrder: number;
}

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<ApiCategory[]>("/categories"),
  });
  const items = useQuery({
    queryKey: ["items"],
    queryFn: () => api<ApiItem[]>("/items"),
  });

  if (cats.isLoading || items.isLoading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }
  if (cats.error || items.error) {
    return <p className="text-sm text-red-600">Failed to load menu</p>;
  }

  const grouped = (cats.data || []).map((c) => ({
    ...c,
    items: (items.data || []).filter((it) => it.categoryId === c.id),
  }));

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-medium text-neutral-900">Menu</h1>
      {grouped.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
          No categories yet.
        </div>
      ) : (
        grouped.map((c) => (
          <div key={c.id} className="bg-white border border-neutral-200 rounded-xl">
            <div className="px-4 py-3 border-b border-neutral-200 text-sm font-medium text-neutral-900">
              {c.name}
            </div>
            <ul className="divide-y divide-neutral-100">
              {c.items.length === 0 ? (
                <li className="px-4 py-3 text-sm text-neutral-400">No dishes</li>
              ) : (
                c.items.map((it) => (
                  <li key={it.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-neutral-900">{it.name}</span>
                    <span className="text-neutral-500 tabular-nums">{it.price}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
