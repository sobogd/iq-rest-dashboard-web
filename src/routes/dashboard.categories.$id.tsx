import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/dashboard/categories/$id")({
  component: EditCategoryPage,
});

function EditCategoryPage() {
  const { id } = Route.useParams();
  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/dashboard" className="text-xs text-neutral-500 inline-flex items-center gap-1 mb-3">
        <ChevronLeft size={12} /> Menu
      </Link>
      <h1 className="text-xl font-medium text-neutral-900 mb-3">Edit category</h1>
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
        Editing {id} — form coming soon.
      </div>
    </div>
  );
}
