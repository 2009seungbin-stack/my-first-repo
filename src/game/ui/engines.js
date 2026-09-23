/** How each engine draws a 9-slice, so the Studio preview shows what that engine will show.
 * Measured with tools/engine-verify/ui (real engines, Kenney CC0 art; see docs/STUDIO-UI.md):
 * which middle modes the engine has, and where a partial tile goes. Pure data + one planner. */
import {ninePlan,normalizeNine} from './nine-patch.js';
export const ENGINES=Object.freeze({
 ideal:{modes:['stretch','tile','tile-fit'],anchor:'start',anchorV:'start'},
 godot:{modes:['stretch','tile','tile-fit'],anchor:'start',anchorV:'start'},
 unity:{modes:['stretch','tile'],anchor:'start',anchorV:'end'},
 css:{modes:['stretch','tile','tile-fit'],anchor:'center',anchorV:'center'},
 phaser:{modes:['stretch'],anchor:'start',anchorV:'start'},
 pixi:{modes:['stretch'],anchor:'start',anchorV:'start'},
 android:{modes:['stretch'],anchor:'start',anchorV:'start'}
});
/** The plan an engine draws, with a note for every setting it cannot honour. */
export function enginePlan(engine,size,nine,tw,th,{scale=1}={}){
 const e=ENGINES[engine]||ENGINES.ideal,n=normalizeNine(nine,size.w,size.h),notes=[];
 const fix=m=>{if(e.modes.includes(m))return m;notes.push({code:'mode',engine,mode:m});return 'stretch';};
 const stretch={h:fix(n.stretch.h),v:fix(n.stretch.v)};
 const plan=ninePlan(size,{...n,stretch},tw,th,{scale,anchor:e.anchor,anchorV:e.anchorV});
 return {...plan,notes};
}
