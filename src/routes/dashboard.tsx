import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900">
        IQ Rest Dashboard
      </header>
      <main className="px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
