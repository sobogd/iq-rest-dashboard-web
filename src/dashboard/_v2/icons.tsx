// SVG icons used across the new dashboard.
// Stroke-based, sized via the `size` prop. Single-color via currentColor.

interface IconProps {
 size?: number;
 className?: string;
}

function svg({ size = 16, className = "", children }: IconProps & { children: React.ReactNode }) {
 return (
 <svg
 width={size}
 height={size}
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 className={className}
 >
 {children}
 </svg>
 );
}

export const ChevronDownIcon = (p: IconProps) => svg({ ...p, children: <polyline points="6 9 12 15 18 9" /> });
export const ChevronLeftIcon = (p: IconProps) => svg({ ...p, children: <polyline points="15 18 9 12 15 6" /> });
export const ChevronRightIcon = (p: IconProps) => svg({ ...p, children: <polyline points="9 18 15 12 9 6" /> });

export const ArrowUpIcon = (p: IconProps) => svg({ ...p, children: <>
 <line x1="12" y1="19" x2="12" y2="5" />
 <polyline points="5 12 12 5 19 12" />
</> });

export const ArrowDownIcon = (p: IconProps) => svg({ ...p, children: <>
 <line x1="12" y1="5" x2="12" y2="19" />
 <polyline points="19 12 12 19 5 12" />
</> });

export const PlusIcon = (p: IconProps) => svg({ ...p, children: <>
 <line x1="12" y1="5" x2="12" y2="19" />
 <line x1="5" y1="12" x2="19" y2="12" />
</> });

export const MinusIcon = (p: IconProps) => svg({ ...p, children: <>
 <line x1="5" y1="12" x2="19" y2="12" />
</> });

export const RefreshIcon = (p: IconProps) => svg({ ...p, children: <>
 <polyline points="23 4 23 10 17 10" />
 <polyline points="1 20 1 14 7 14" />
 <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
 <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
</> });

export const FolderIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
</> });

export const BoxIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
 <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
 <line x1="12" y1="22.08" x2="12" y2="12" />
</> });

export const EditIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
 <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
</> });

export const TrashIcon = (p: IconProps) => svg({ ...p, children: <>
 <polyline points="3 6 5 6 21 6" />
 <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
 <line x1="10" y1="11" x2="10" y2="17" />
 <line x1="14" y1="11" x2="14" y2="17" />
</> });

export const EyeIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
 <circle cx="12" cy="12" r="3" />
</> });

export const EyeOffIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
 <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
 <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
 <line x1="1" y1="1" x2="23" y2="23" />
</> });

export const CloseIcon = (p: IconProps) => svg({ ...p, children: <>
 <line x1="18" y1="6" x2="6" y2="18" />
 <line x1="6" y1="6" x2="18" y2="18" />
</> });

export const SparklesIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
 <path d="M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
 <path d="M5 3l.6 1.4 1.4.6-1.4.6L5 7l-.6-1.4L3 5l1.4-.6z" />
</> });

export const GridIcon = (p: IconProps) => svg({ ...p, children: <>
 <rect x="3" y="3" width="7" height="7" />
 <rect x="14" y="3" width="7" height="7" />
 <rect x="3" y="14" width="7" height="7" />
 <rect x="14" y="14" width="7" height="7" />
</> });

export const CalendarIcon = (p: IconProps) => svg({ ...p, children: <>
 <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
 <line x1="16" y1="2" x2="16" y2="6" />
 <line x1="8" y1="2" x2="8" y2="6" />
 <line x1="3" y1="10" x2="21" y2="10" />
</> });

export const UsersIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
 <circle cx="8.5" cy="7" r="4" />
 <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
 <path d="M16 3.13a4 4 0 0 1 0 7.75" />
</> });

export const MapPinIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
 <circle cx="12" cy="10" r="3" />
</> });

export const ClockIcon = (p: IconProps) => svg({ ...p, children: <>
 <circle cx="12" cy="12" r="10" />
 <polyline points="12 6 12 12 16 14" />
</> });

export const ReceiptIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M5 2v20l3-2 3 2 3-2 3 2 3-2V2H5z" />
 <line x1="9" y1="7" x2="15" y2="7" />
 <line x1="9" y1="11" x2="15" y2="11" />
</> });

export const FlameIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
</> });

export const MessageIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
</> });

export const QrIcon = (p: IconProps) => svg({ ...p, children: <>
 <rect x="3" y="3" width="7" height="7" rx="1" />
 <rect x="14" y="3" width="7" height="7" rx="1" />
 <rect x="3" y="14" width="7" height="7" rx="1" />
 <path d="M14 14h3v3h-3z M20 14v3 M14 20h3 M20 20h1" />
</> });

export const SendIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M22 2 11 13" />
 <path d="m22 2-7 20-4-9-9-4 20-7z" />
</> });

export const SettingsIcon = (p: IconProps) => svg({ ...p, children: <>
 <circle cx="12" cy="12" r="3" />
 <path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
</> });

export const ChartIcon = (p: IconProps) => svg({ ...p, children: <>
 <line x1="12" y1="20" x2="12" y2="10" />
 <line x1="18" y1="20" x2="18" y2="4" />
 <line x1="6" y1="20" x2="6" y2="16" />
</> });

export const ExpandIcon = (p: IconProps) => svg({ ...p, children: <>
 <polyline points="7 13 12 18 17 13" />
 <polyline points="7 6 12 11 17 6" />
</> });

export const CollapseIcon = (p: IconProps) => svg({ ...p, children: <>
 <polyline points="7 18 12 13 17 18" />
 <polyline points="7 11 12 6 17 11" />
</> });

export const CopyIcon = (p: IconProps) => svg({ ...p, children: <>
 <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
 <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
</> });

export const CheckIcon = (p: IconProps) => svg({ ...p, children: <polyline points="20 6 9 17 4 12" /> });

export const ExternalLinkIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
 <polyline points="15 3 21 3 21 9" />
 <line x1="10" y1="14" x2="21" y2="3" />
</> });

export const ShareIcon = (p: IconProps) => svg({ ...p, children: <>
 <circle cx="18" cy="5" r="3" />
 <circle cx="6" cy="12" r="3" />
 <circle cx="18" cy="19" r="3" />
 <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
 <line x1="15.41" y1="6.51" x2="8.59" y2="11.49" />
</> });

export const DownloadIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
 <polyline points="7 10 12 15 17 10" />
 <line x1="12" y1="15" x2="12" y2="3" />
</> });

export const PhotoIcon = (p: IconProps) => svg({ ...p, children: <>
 <rect x="3" y="3" width="18" height="18" rx="2" />
 <circle cx="9" cy="9" r="2" />
 <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
</> });

export const LogoutIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
 <polyline points="16 17 21 12 16 7" />
 <line x1="21" y1="12" x2="9" y2="12" />
</> });

export const MoreVerticalIcon = (p: IconProps) => svg({ ...p, children: <>
 <circle cx="12" cy="5" r="1" />
 <circle cx="12" cy="12" r="1" />
 <circle cx="12" cy="19" r="1" />
</> });

export const SwapIcon = (p: IconProps) => svg({ ...p, children: <>
 <polyline points="17 1 21 5 17 9" />
 <path d="M3 11V9a4 4 0 0 1 4-4h14" />
 <polyline points="7 23 3 19 7 15" />
 <path d="M21 13v2a4 4 0 0 1-4 4H3" />
</> });

export const SplitIcon = (p: IconProps) => svg({ ...p, children: <>
 <path d="M12 3v6" />
 <path d="M8 13l4-4 4 4" />
 <path d="M6 21h4" />
 <path d="M14 21h4" />
 <path d="M8 13v8" />
 <path d="M16 13v8" />
</> });
