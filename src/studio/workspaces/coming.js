/** Workspaces that are registered so the switcher and docs know them, but are not built yet.
 * They have no activate(): the shell shows them as "coming" (disabled, with the phase and what
 * they will do) and never renders a button for a feature that does not exist. */
export const COMING=Object.freeze([
 {id:'sprite',title:'ws.sprite',status:'coming',phase:'P1',summary:'ws.spriteSummary'},
 {id:'pixel',title:'ws.pixel',status:'coming',phase:'P2',summary:'ws.pixelSummary'},
 {id:'texture',title:'ws.texture',status:'coming',phase:'P4',summary:'ws.textureSummary'},
 {id:'ui',title:'ws.ui',status:'coming',phase:'P5',summary:'ws.uiSummary'}
]);
