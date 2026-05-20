import type { SVGProps } from "react";

// 24x24 viewBox, stroke=currentColor, fill=none.
const ICONS: Record<string, string> = {
  vegan: `
    <path d="M4 20c0-8 5-14 16-15-.5 10-7 15-15 15"/>
    <path d="M4 20l9-10"/>
  `,
  vegetarian: `
    <path d="M5 19c0-6 4-10 10-11 0 6-4 11-10 11z"/>
    <path d="M15 8c1.5-2 4-3 5-2"/>
  `,
  pescatarian: `
    <path d="M3 12c0-2.5 3.5-6 8.5-6S19 9.5 19 12s-2.5 6-7.5 6S3 14.5 3 12z"/>
    <path d="M19 9.5l3-3v11l-3-3"/>
    <circle cx="14" cy="11" r=".7" fill="currentColor"/>
  `,
  gluten_free: `
    <path d="M12 4v14"/>
    <path d="M12 8c1.5-1.5 3-1.5 4-.5-.5 2-2 3-4 3"/>
    <path d="M12 8c-1.5-1.5-3-1.5-4-.5.5 2 2 3 4 3"/>
    <path d="M12 13c1.5-1.5 3-1.5 4-.5-.5 2-2 3-4 3"/>
    <path d="M12 13c-1.5-1.5-3-1.5-4-.5.5 2 2 3 4 3"/>
    <path d="M4 20L20 4" stroke-width="2.2"/>
  `,
  lactose_free: `
    <path d="M12 4c2 3 4 6 4 9a4 4 0 0 1-8 0c0-3 2-6 4-9z"/>
    <path d="M4 20L20 4" stroke-width="2.2"/>
  `,
  nut_free: `
    <path d="M12 4c-3 0-5 2.5-5 5 0 2 1 3 1 5s-1 3-1 5c0 1.5 2 3 5 3s5-1.5 5-3c0-2-1-3-1-5s1-3 1-5c0-2.5-2-5-5-5z"/>
    <path d="M4 20L20 4" stroke-width="2.2"/>
  `,
  sugar_free: `
    <path d="M5 9l7-4 7 4v6l-7 4-7-4z"/>
    <path d="M5 9l7 4 7-4"/>
    <path d="M12 13v6"/>
    <path d="M4 20L20 4" stroke-width="2.2"/>
  `,
  low_carb: `
    <path d="M4 12c0-3 3-5 8-5s8 2 8 5v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>
    <path d="M8 11v2"/>
    <path d="M12 11v2"/>
    <path d="M16 11v2"/>
    <path d="M19 19l2-2M19 19l-2-2"/>
  `,
  keto: `
    <path d="M12 3c-3.5 0-6.5 3-6.5 7s2 9 6.5 11c4.5-2 6.5-7 6.5-11s-3-7-6.5-7z"/>
    <ellipse cx="12" cy="11" rx="2" ry="3" fill="currentColor"/>
  `,
  halal: `
    <path d="M17 5a8 8 0 1 0 0 14 6.5 6.5 0 0 1 0-14z"/>
    <path d="M19 8l.7 1.5L21 10l-1.3.5L19 12l-.7-1.5L17 10l1.3-.5z"/>
  `,
  kosher: `
    <path d="M12 3l4 7-4 7-4-7z" />
    <path d="M12 21l-4-7 4-7 4 7z" />
  `,
  spicy: `
    <path d="M14 4c-1 1.5-1 3 0 4"/>
    <path d="M14 8c-5 0-9 4-9 9 0 2 1 3 3 3 5 0 11-4 11-10 0-1.5-2-2-5-2z"/>
  `,
  organic: `
    <circle cx="12" cy="12" r="9"/>
    <path d="M7 14c2-6 6-8 10-8-1 6-4 10-10 10z"/>
    <path d="M7 16l5-4"/>
  `,
};

const FALLBACK = `
  <circle cx="12" cy="12" r="9"/>
  <path d="M8 12l3 3 5-6"/>
`;

interface DietIconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> {
  code: string;
}

export function DietIcon({ code, ...props }: DietIconProps) {
  const inner = ICONS[code] ?? FALLBACK;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
