/** Lightweight directory copy; importing it never loads a compatibility dataset. */
const titles={ko:'업그레이드 전 호환성 확인',en:'Check before you upgrade',ja:'更新前に互換性を確認'};
export function preflightDirectory(locale){
 const title=titles[locale]||titles.en,description='OBS · Studio · Blender · Godot';
 return {title,description,search:[...Object.values(titles),description,'preflight compatibility plugin upgrade 호환성 플러그인 업데이트 互換性'].join(' ').toLowerCase()};
}
