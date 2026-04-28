import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings/bookings")({
  component: BookingsSettingsPage,
});

function BookingsSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/dashboard/settings" className="text-xs text-neutral-500 inline-flex items-center gap-1 mb-3">
        <ChevronLeft size={12} /> Settings
      </Link>
      <h1 className="text-xl font-medium text-neutral-900 mb-3">Bookings</h1>
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
        Bookings settings — coming soon.
      </div>
    </div>
  );
}
