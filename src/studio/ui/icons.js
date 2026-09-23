/** 16×16 stroke icons for the Studio chrome (inline SVG, currentColor). */
const svg=body=>`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICONS={
 move:svg('<path d="M3 2l9 5-4 1.2L6.8 12z"/><path d="M8.2 8.4l3.3 3.3"/>'),
 hand:svg('<path d="M5 8V3.5a1 1 0 012 0V7m0-.5V2.5a1 1 0 012 0V7m0-.5V3.5a1 1 0 012 0v5.5c0 3-1.8 5-4.5 5-2 0-3-1-4-2.6L2.4 8.9a1 1 0 011.6-1.2L5 9"/>'),
 zoom:svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14M5 7h4M7 5v4"/>'),
 marquee:svg('<path d="M2 4V2h2M7 2h2M12 2h2v2M14 7v2M14 12v2h-2M9 14H7M4 14H2v-2M2 9V7"/>'),
 grid:svg('<path d="M2 2h12v12H2zM6 2v12M10 2v12M2 6h12M2 10h12"/>'),
 fit:svg('<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>'),
 plus:svg('<path d="M8 3v10M3 8h10"/>'),
 minus:svg('<path d="M3 8h10"/>'),
 eye:svg('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'),
 trash:svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>'),
 more:svg('<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>'),
 chevron:svg('<path d="M5 6l3 3 3-3"/>'),
 image:svg('<rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="6" cy="6.5" r="1.2"/><path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3"/>'),
 undo:svg('<path d="M5 5L2 8l3 3"/><path d="M2 8h7.5a4 4 0 010 8"/>'),
 menu:svg('<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>'),
 panels:svg('<rect x="2" y="2.5" width="12" height="11" rx="1"/><path d="M10 2.5v11"/>'),
 close:svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
 keyboard:svg('<rect x="1.5" y="4" width="13" height="8" rx="1"/><path d="M4 7h1M7 7h1M10 7h1M4.5 9.5h7"/>'),
 search:svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14"/>'),
 pin:svg('<path d="M8 1.5v4M5 5.5h6l-1 4H6zM8 9.5v5"/>')
};
export const icon=name=>ICONS[name]||'';
