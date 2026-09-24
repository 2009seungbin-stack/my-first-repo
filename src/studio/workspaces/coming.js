/** Workspaces that are registered so the switcher and docs know them, but are not built yet.
 * They have no activate(): the shell shows them as "coming" (disabled, with the phase and what
 * they will do) and never renders a button for a feature that does not exist. */
export const COMING=Object.freeze([
 {id:'pixel',title:'ws.pixel',status:'coming',phase:'P2',summary:'ws.pixelSummary'},
 {id:'ui',title:'ws.ui',status:'coming',phase:'P5',summary:'ws.uiSummary'}
]);
