// Centred spinner shown while a route's async beforeLoad runs (auth
// check, etc.) or while a lazy-loaded chunk downloads. Kept intentionally
// tiny so it stays in the initial bundle — pulling Tailwind classes only.

export function FullPageLoader() {
  return (
    <div className="min-h-svh flex items-center justify-center bg-background">
      <div
        className="h-8 w-8 rounded-full border-2 border-foreground/15 border-t-foreground animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
