import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ ok: boolean; time: string }>("/health"),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-medium text-neutral-900 mb-3">Menu</h1>
      <div className="bg-white border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700">
        {isLoading ? "Checking API…" : error ? `API error: ${(error as Error).message}` : `API ok @ ${data?.time}`}
      </div>
    </div>
  );
}
