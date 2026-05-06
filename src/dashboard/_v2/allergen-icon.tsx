import type { SVGProps } from "react";

// Inner SVG markup for each allergen. All share the same outer <svg> attrs
// (24x24 viewBox, currentColor stroke).
const ICONS: Record<string, string> = {
  gluten: `
    <path d="M12 3v18"/>
    <path d="M12 7c1.5-1.5 3.5-1.5 4.5-.5-.5 2-2.5 3-4.5 3"/>
    <path d="M12 7c-1.5-1.5-3.5-1.5-4.5-.5.5 2 2.5 3 4.5 3"/>
    <path d="M12 12c1.5-1.5 3.5-1.5 4.5-.5-.5 2-2.5 3-4.5 3"/>
    <path d="M12 12c-1.5-1.5-3.5-1.5-4.5-.5.5 2 2.5 3 4.5 3"/>
    <path d="M12 17c1.5-1.5 3.5-1.5 4.5-.5-.5 2-2.5 3-4.5 3"/>
    <path d="M12 17c-1.5-1.5-3.5-1.5-4.5-.5.5 2 2.5 3 4.5 3"/>
  `,
  crustaceans: `
    <path d="M3 13c0-3 2.5-5 5.5-5H15c2 0 3.5 1.5 3.5 3.5S17 15 15 15h-2"/>
    <path d="M3 13c0 3 2.5 5 5.5 5H10"/>
    <path d="M9 18l-1.5 3"/>
    <path d="M11 18l-.5 3"/>
    <circle cx="16" cy="10.5" r=".7" fill="currentColor"/>
    <path d="M18.5 10l3-2"/>
    <path d="M18.5 11l3 2"/>
  `,
  eggs: `<ellipse cx="12" cy="13" rx="6" ry="8"/>`,
  fish: `
    <path d="M3 12c0-2.5 3.5-6 8.5-6S19 9.5 19 12s-2.5 6-7.5 6S3 14.5 3 12z"/>
    <path d="M19 9.5l3-3v11l-3-3"/>
    <circle cx="14" cy="11" r=".7" fill="currentColor"/>
  `,
  peanuts: `
    <path d="M12 2.5c-2.5 0-4 2-4 4s1.5 3 1.5 5c0 1-1.5 2-1.5 4.5 0 3 2 5 4 5s4-2 4-5c0-2.5-1.5-3.5-1.5-4.5 0-2 1.5-3 1.5-5s-1.5-4-4-4z"/>
    <path d="M9 11.5c2 .5 4 .5 6 0"/>
  `,
  soybeans: `
    <path d="M3.5 17C3 11 8 5.5 14 5c2.5-.2 4.5.5 5.5 1.5C20 12.5 15 18 9 18.5c-2.5.2-4.5-.5-5.5-1.5z"/>
    <circle cx="8" cy="14" r="1.4"/>
    <circle cx="12" cy="11" r="1.4"/>
    <circle cx="16" cy="8.5" r="1.4"/>
  `,
  dairy: `
    <path d="M8 3h8v3l2 3v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-3V3z"/>
    <path d="M6 9h12"/>
    <path d="M9.5 13.5h5"/>
  `,
  nuts: `
    <path d="M12 4c-4.5 0-8 3.5-8 8s3.5 9 8 9 8-4.5 8-9-3.5-8-8-8z"/>
    <path d="M12 4c-1.5 1-1.5 4 0 5 1.5-1 1.5-4 0-5z"/>
    <path d="M7 13c1 0 2 1 2 2"/>
    <path d="M17 13c-1 0-2 1-2 2"/>
  `,
  celery: `
    <path d="M12 22V9"/>
    <path d="M12 9C9 6 5 6 4 8c1 3 4 5 8 5"/>
    <path d="M12 9c3-3 7-3 8-1-1 3-4 5-8 5"/>
    <path d="M12 6c-.5-1.5-1-2.5-1-4"/>
    <path d="M12 6c.5-1.5 1-2.5 1-4"/>
  `,
  mustard: `
    <path d="M10 2h4v3h-4z"/>
    <path d="M8 5h8v3H8z"/>
    <path d="M7 8h10v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8z"/>
    <path d="M9.5 14h5"/>
    <path d="M9.5 17h5"/>
  `,
  sesame: `
    <ellipse cx="7" cy="9" rx="2" ry="3" transform="rotate(-30 7 9)"/>
    <ellipse cx="13" cy="6.5" rx="2" ry="3" transform="rotate(20 13 6.5)"/>
    <ellipse cx="17.5" cy="12" rx="2" ry="3" transform="rotate(-20 17.5 12)"/>
    <ellipse cx="9" cy="16" rx="2" ry="3" transform="rotate(35 9 16)"/>
    <ellipse cx="15" cy="18" rx="2" ry="3" transform="rotate(-30 15 18)"/>
  `,
  sulphites: `
    <path d="M7 3h10l-1 7a4 4 0 0 1-8 0l-1-7z"/>
    <path d="M12 14v6"/>
    <path d="M8 20h8"/>
  `,
  lupin: `
    <path d="M12 22V10"/>
    <ellipse cx="10" cy="10" rx="2" ry="1.4"/>
    <ellipse cx="14" cy="10" rx="2" ry="1.4"/>
    <ellipse cx="10.5" cy="7" rx="1.7" ry="1.2"/>
    <ellipse cx="13.5" cy="7" rx="1.7" ry="1.2"/>
    <ellipse cx="12" cy="4" rx="1.5" ry="1.1"/>
    <path d="M14.5 17l3-2"/>
    <path d="M9.5 17l-3-2"/>
  `,
  molluscs: `
    <path d="M3 13c0-5 4-9 9-9s9 4 9 9c-2 1-5 1.5-9 1.5S5 14 3 13z"/>
    <path d="M12 4v10.5"/>
    <path d="M9 4.5v9.5"/>
    <path d="M15 4.5v9.5"/>
    <path d="M6 6.5v7"/>
    <path d="M18 6.5v7"/>
  `,
};

const FALLBACK = `
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 8v4"/>
  <path d="M12 16h.01"/>
`;

interface AllergenIconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> {
  code: string;
}

export function AllergenIcon({ code, ...props }: AllergenIconProps) {
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
