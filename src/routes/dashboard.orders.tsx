import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ApiOrder {
  id: string;
  status: string;
  tableNumber: number | null;
  customerName: string | null;
  total: string | null;
  createdAt: string;
}

export const Route = createFileRoute("/dashboard/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<ApiOrder[]>("/orders"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-medium text-neutral-900">Orders</h1>
      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">No orders</div>
      ) : (
        <ul className="space-y-2">
          {data.map((o) => (
            <li key={o.id} className="bg-white border border-neutral-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  {o.tableNumber ? `Table #${o.tableNumber}` : o.customerName || "Order"}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(o.createdAt).toLocaleString()} · {o.status}
                </div>
              </div>
              <div className="text-sm tabular-nums text-neutral-900">{o.total || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
