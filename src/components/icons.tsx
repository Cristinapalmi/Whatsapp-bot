/** Ícones SVG simples (sem emojis, sem bibliotecas externas). */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 22, ...p }: P) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const IconPlay = (p: P) => <svg {...base(p)}><path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" stroke="none" /></svg>;
export const IconPause = (p: P) => <svg {...base(p)}><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></svg>;
export const IconLock = (p: P) => <svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>;
export const IconCheck = (p: P) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconClock = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconHome = (p: P) => <svg {...base(p)}><path d="M4 11l8-6.5 8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9z" /></svg>;
export const IconUser = (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 20.5c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5" /></svg>;
export const IconWallet = (p: P) => <svg {...base(p)}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="7.5" width="16.5" height="12" rx="2" /><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" /></svg>;
export const IconBell = (p: P) => <svg {...base(p)}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
export const IconUpload = (p: P) => <svg {...base(p)}><path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" /><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" /></svg>;
export const IconCopy = (p: P) => <svg {...base(p)}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>;
export const IconChevronRight = (p: P) => <svg {...base(p)}><path d="M9.5 6l6 6-6 6" /></svg>;
export const IconChevronLeft = (p: P) => <svg {...base(p)}><path d="M14.5 6l-6 6 6 6" /></svg>;
export const IconX = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconFilm = (p: P) => <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" /></svg>;
export const IconNext = (p: P) => <svg {...base(p)}><path d="M5.5 5v14l10-7-10-7z" fill="currentColor" stroke="none" /><path d="M18.5 5v14" /></svg>;
export const IconSubtitles = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 12.5h3M13 12.5h4M7 15.5h6M15 15.5h2" /></svg>;
export const IconGauge = (p: P) => <svg {...base(p)}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /></svg>;
export const IconFlag = (p: P) => <svg {...base(p)}><path d="M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11" /></svg>;
export const IconShield = (p: P) => <svg {...base(p)}><path d="M12 3.5l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6.5l7.5-3z" /></svg>;
export const IconChart = (p: P) => <svg {...base(p)}><path d="M4.5 19.5h15M7.5 16v-5M12 16V7M16.5 16v-8" /></svg>;
export const IconDownload = (p: P) => <svg {...base(p)}><path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5" /><path d="M4.5 19.5h15" /></svg>;
export const IconLogout = (p: P) => <svg {...base(p)}><path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M10 16.5L5.5 12 10 7.5M5.5 12H15" /></svg>;
export const IconStar = (p: P) => <svg {...base(p)}><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4z" /></svg>;
export const IconExpand = (p: P) => <svg {...base(p)}><path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" /></svg>;
export const IconGift = (p: P) => <svg {...base(p)}><rect x="4" y="9" width="16" height="11.5" rx="1.5" /><path d="M3 9h18M12 9v11.5" /><path d="M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" /></svg>;
export const IconTrophy = (p: P) => <svg {...base(p)}><path d="M8 4.5h8v5a4 4 0 0 1-8 0v-5z" /><path d="M8 6.5H5a3 3 0 0 0 3 4M16 6.5h3a3 3 0 0 1-3 4M12 13.5v3.5M8.5 20.5h7M9.5 17h5" /></svg>;
export const IconLink = (p: P) => <svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
export const IconCoin = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><path d="M12 9.5v5" /></svg>;
export const IconHeart = (p: P) => <svg {...base(p)}><path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></svg>;
export const IconBookmark = (p: P) => <svg {...base(p)}><path d="M6.5 4.5h11v16l-5.5-4-5.5 4v-16z" /></svg>;
export const IconCrown = (p: P) => <svg {...base(p)}><path d="M4 8l4 4 4-6 4 6 4-4-1.5 10h-13L4 8z" /></svg>;
export const IconSparkle = (p: P) => <svg {...base(p)}><path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 3.5z" /></svg>;
export const IconFire = (p: P) => <svg {...base(p)}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.6 4-7.6.6 1.6 1.6 2.6 2.7 3 .2-2.8 1.3-5.3 3.3-7.2.2 2.7 1.5 4.3 2.7 5.8 1 1.3 1.8 2.6 1.8 4.6 0 4.2-3.2 7.6-8 7.6z" /></svg>;
export const IconCalendar = (p: P) => <svg {...base(p)}><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg>;
