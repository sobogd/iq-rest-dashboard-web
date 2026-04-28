import { Loader2 } from "lucide-react";

interface PageLoaderProps {
 className?: string;
}

export function PageLoader({ className }: PageLoaderProps) {
 return (
 <div className={`flex min-h-dvh h-full items-center justify-center ${className || ""}`}>
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
}
