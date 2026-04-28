"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "@/i18n/routing";
// DashboardNavHeader was removed with the legacy shell; admin pages no longer render it.
const DashboardNavHeader = () => null;

interface PageHeaderProps {
 title: string;
 children?: React.ReactNode;
 onBack?: () => void;
 backHref?: string;
}

export function PageHeader({ title, children, onBack, backHref = "/dashboard" }: PageHeaderProps) {
 const router = useRouter();
 const pushedRef = useRef(false);

 const handleBack = () => {
 if (onBack) return onBack();
 router.push(backHref);
 };

 // Intercept browser back button
 useEffect(() => {
 if (onBack) return;

 if (!pushedRef.current) {
 window.history.pushState(null, "", window.location.href);
 pushedRef.current = true;
 }

 const onPopState = () => {
 router.push(backHref);
 };

 window.addEventListener("popstate", onPopState);
 return () => window.removeEventListener("popstate", onPopState);
 }, [onBack, backHref, router]);

 return (
 <header className="shrink-0 border-b border-border px-6 bg-background/80 backdrop-blur-lg">
 <div className="flex items-center py-3 max-w-lg md:max-w-none md:w-[45rem] mx-auto md:gap-4">
 <DashboardNavHeader />
 <button
 onClick={handleBack}
 className="flex items-center justify-center h-10 w-10 -ml-2"
 >
 <ArrowLeft className="h-5 w-5" />
 </button>
 <h1 className="text-xl font-medium flex-1 ml-3 md:ml-0 truncate">{title}</h1>
 {children}
 </div>
 </header>
 );
}
