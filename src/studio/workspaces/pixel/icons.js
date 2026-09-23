/** 16×16 stroke icons of the Pixel workspace tools and panels (inline SVG, currentColor). */
const svg=b=>`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${b}</svg>`;
export const PIXEL_ICONS={
 pxPencil:svg('<path d="M11 2.5l2.5 2.5-7.5 7.5H3.5V10z"/><path d="M9.5 4l2.5 2.5"/>'),
 pxEraser:svg('<path d="M6 13.5h7.5M3 10l6.5-6.5 4 4L7 14H5z"/><path d="M6.5 6.5l4 4"/>'),
 pxBucket:svg('<path d="M3 7l5-5 5.5 5.5-5 5z"/><path d="M13.5 10.5s1.5 2 1.5 3a1.5 1.5 0 01-3 0c0-1 1.5-3 1.5-3z"/>'),
 pxPicker:svg('<path d="M9.5 2.5l4 4-1.5 1.5-4-4z"/><path d="M8 5.5L2.5 11v2.5H5L10.5 8"/>'),
 pxLine:svg('<path d="M3 13L13 3"/><rect x="2" y="12" width="2" height="2" fill="currentColor"/><rect x="12" y="2" width="2" height="2" fill="currentColor"/>'),
 pxRect:svg('<rect x="2.5" y="3.5" width="11" height="9"/>'),
 pxEllipse:svg('<ellipse cx="8" cy="8" rx="5.5" ry="4.5"/>'),
 pxMarquee:svg('<path d="M2 4V2h2M7 2h2M12 2h2v2M14 7v2M14 12v2h-2M9 14H7M4 14H2v-2M2 9V7"/>'),
 pxLasso:svg('<path d="M4.5 11C2.5 10 2 8.5 2.5 6.8 3.3 4 6.5 2.5 9.5 3s4.5 2.5 4 4.8S10 11 7 11c-1 0-2 0-2.5 0z" stroke-dasharray="2 1.6"/><path d="M4.5 11c.5 1.5-.5 2.5-1.5 3"/>'),
 pxWand:svg('<path d="M2.5 13.5l7-7"/><path d="M11 1.5v2M11 7.5v2M8 4.5h2M12 4.5h2M9 2.5l1 1M13 6.5l-1-1M13 2.5l-1 1"/>'),
 pxMove:svg('<path d="M8 1.5v13M1.5 8h13M8 1.5L6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2"/>'),
 pxSwap:svg('<path d="M4 6h8l-2-2M12 10H4l2 2"/>'),
 pxLock:svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>'),
 pxUnlock:svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 014.8-1"/>'),
 pxUp:svg('<path d="M8 13V3M4 7l4-4 4 4"/>'),
 pxDown:svg('<path d="M8 3v10M4 9l4 4 4-4"/>'),
 pxCopy:svg('<rect x="5" y="5" width="8.5" height="8.5" rx="1"/><path d="M3 11V3.5a1 1 0 011-1h7"/>'),
 pxMerge:svg('<path d="M3 3h10M3 6h10M8 8v6M5 11l3 3 3-3"/>'),
 pxMenu:svg('<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>'),
 pxSort:svg('<path d="M4 3v10M2 11l2 2 2-2M9 4h5M9 8h4M9 12h3"/>'),
 pxGlobe:svg('<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2.2 2 9.8 0 12M8 2c-2 2.2-2 9.8 0 12"/>')
};
