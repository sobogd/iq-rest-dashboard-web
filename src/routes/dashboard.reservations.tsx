import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ApiReservation {
  id: string;
  date: string;
  startTime: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestsCount: number;
  status: string;
  tableId: string;
}

export const Route = createFileRoute("/dashboard/reservations")({
  component: ReservationsPage,
});

function ReservationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: () => api<ApiReservation[]>("/reservations"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-medium text-neutral-900">Reservations</h1>
      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">No reservations</div>
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-900">{r.guestName}</div>
                <div className="text-xs text-neutral-500">{r.status}</div>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {new Date(r.date).toLocaleDateString()} · {r.startTime} · {r.guestsCount} guests
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
