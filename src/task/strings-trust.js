/** Copy for the trust fixes in the game Labs (colour keys, unassigned islands, confidence of
 * automatic guesses, resampled upscales, height sources, font grids, palette swaps, animation
 * grouping). Kept in its own module and merged into the shared tables at import time, so the
 * big strings.js stays untouched; every key exists in ko, en and ja (tests/game-trust-ui.test.mjs
 * checks the parity). Lab modules import this file for its side effect. */
import {UI_STRINGS as S} from './strings.js';
const merge=(target,add)=>{for(const [k,v] of Object.entries(add)){if(v&&typeof v==='object'&&!Array.isArray(v)){target[k]=target[k]&&typeof target[k]==='object'?target[k]:{};merge(target[k],v);}else target[k]=v;}return target;};
export const TRUST_STRINGS={
 en:{
  confidence:{high:'high',medium:'medium',low:'low'},
  lab:{
   keyApplied:'Background {hex} made transparent · {conf} confidence',keySuggest:'This sheet looks like it sits on {hex} ({conf} confidence).',
   keyUse:'Make it transparent',keyOff:'Keep the background',keyWhy:'Why',
   sliceHint:'Click to select · Shift+click selects a range · Ctrl/⌘+click adds or removes one · drag to move, drag empty space to add, corner handles to resize · Delete removes (Ctrl+Z undoes).',
   mergeWhy:{single:'the whole sheet is one connected island — use a grid, or drop its background colour first',apart:'no two islands are within {until}px of each other, so each one is a frame'},
   islandsAttached:'{n} small island(s) ({px} px) joined the frame next to them',
   islandsUnassigned:'{n} small island(s), {px} px, are in no frame',
   islandsShow:'Show them',islandsHide:'Hide',islandsAttach:'Attach to the nearest frame',islandsAdd:'Add them as frames',
   gridHint:'Frames touch each other: Auto sees {auto} islands, the {w}×{h} grid ({conf}) gives {grid} frames.',useGrid:'Use the grid',
   labelling:'Finding islands… {a}%',
   deleteAgain:'Press Delete again to remove {n} frame(s) from the whole project (Ctrl+Z undoes).',deleted:'{n} frame(s) deleted — Ctrl+Z to undo',
   errorTitle:'Could not slice',gridColour:'from pixel colours'
  },
  tile:{
   confirmBanner:'Suggested grid {w}×{h} ({conf} confidence) — check the lines against the sheet.',confirm:'The grid is right',
   lowBanner:'No grid was found with confidence. The lines show the manual size; pick a suggestion or enter the tile size.',
   confidenceLabel:'confidence',layoutReason:'laid out like a {layout} template',contentBlank:'{n} blank cell(s)',contentEdges:'{n}% of tile sides repeat',
   templateArt:'Showing template art, not your sheet: {why}.',whyShort:'the sheet has {n} tiles and this rule set needs {total}',whyGrid:'the grid is not confirmed yet',whyChosen:'template art is selected',
   mapMissing:'{n} cell(s) have no tile',sheetMissing:'{n} slot(s) of the rule set are missing in the sheet',mismatch:'{n} tile(s) do not look like their slot',
   mismatchLine:'Slot {i}: side {sides} does not match the rule',mapComplete:'Every cell is drawn with a tile from your sheet, and the rules find nothing missing.',
   rulesMismatch:'{n} tile(s) look wrong for their slot'
  },
  plab:{
   verdictResampled:'Resampled ≈{s}× — not a whole-number pixel grid',resampledInteger:'≈{s}× but smoothed: the pixels were interpolated, not copied',
   resampledNote:'{kind} · {conf} confidence. The original pixels cannot be recovered exactly; a nearest-neighbour reduction to ≈{w}×{h} would only be an approximation.',
   smoothed:'smoothed (bilinear or similar)',notSmoothed:'blocks of uneven width (nearest-neighbour at a fractional scale)'
  },
  texture:{
   heightSource:'Height map',heightAuto:'{name} (classified as height)',heightChosen:'{name}',heightMissing:'No file is classified as a height map. Choose the file that holds height.',
   heightWrong:'{name} is classified as {role}, not height. A normal map from it follows the colours, not the surface.',
   heightPick:'Choose…',addedToSet:'{name} was added to the set — the Preview uses it.',addToSet:'Add to the set',
   generatedNote:'generated here'
  },
  uiLab:{
   fontDetected:'Grid {cw}×{ch} · {cols}×{rows} cells · {order} · {conf} confidence',fontOrders:{ascii:'ASCII from the space (32)',ascii33:'ASCII from "!" (33)',cp437:'code page 437 (0–255)'},
   fontUndetected:'No glyph grid stood out. Enter the cell size and the character order.',fontApplyDetected:'Use the detected grid',
   guideUndo:'Undo guide move',guideRedo:'Redo'
  },
  atlas:{
   animations:'Animations',animationsFound:'{n} animation(s) from the file names',animationAll:'All frames',
   canvasNote:'Frames of different sizes share one {w}×{h} canvas (bottom-centred), and the data file says so, so they play without jumping.'
  },
  pswap:{
   drop:'Drop a sprite or tileset',dropHint:'The palette is read from the image · swap several colours at once · nothing is uploaded',
   palette:'Colours in the image',paletteCount:'{n} colour(s)',paletteMore:'+{n} more',pick:'Pick from the image',pickHint:'Click a pixel in the image, or a swatch, to swap that colour.',
   swaps:'Swaps',addSwap:'+ Add a swap',removeSwap:'Remove',from:'From',to:'To',tolerance:'Similar-colour range',shading:'Keep shading',noSwaps:'Pick a colour to start.',
   run:'Download',runMany:'Download {n} images (ZIP)',changed:'{n} pixel(s) change',done:'Saved ({size})',before:'Original',after:'Swapped',zoom:'Zoom',sample:'Sample sprite'
  }
 },
 ko:{
  confidence:{high:'높음',medium:'보통',low:'낮음'},
  lab:{
   keyApplied:'배경색 {hex}을(를) 투명하게 처리 · 신뢰도 {conf}',keySuggest:'이 시트는 {hex} 배경 위에 있는 것 같습니다 (신뢰도 {conf}).',
   keyUse:'투명하게 만들기',keyOff:'배경 그대로 두기',keyWhy:'근거',
   sliceHint:'클릭으로 선택 · Shift+클릭은 범위 선택 · Ctrl/⌘+클릭은 하나씩 추가·제외 · 끌어서 이동, 빈 곳을 끌면 추가, 모서리 핸들로 크기 조절 · Delete로 삭제(Ctrl+Z로 되돌리기).',
   mergeWhy:{single:'시트 전체가 하나로 이어진 덩어리입니다 — 격자를 쓰거나 먼저 배경색을 지우세요',apart:'{until}px 안에 붙어 있는 덩어리가 없어 각각을 프레임으로 봅니다'},
   islandsAttached:'작은 조각 {n}개({px}px)를 옆 프레임에 붙였습니다',
   islandsUnassigned:'작은 조각 {n}개({px}px)가 어느 프레임에도 속하지 않습니다',
   islandsShow:'표시하기',islandsHide:'숨기기',islandsAttach:'가장 가까운 프레임에 붙이기',islandsAdd:'프레임으로 추가',
   gridHint:'프레임끼리 붙어 있습니다: 자동은 덩어리 {auto}개를 찾았고, {w}×{h} 격자(신뢰도 {conf})로는 {grid}프레임입니다.',useGrid:'격자 사용',
   labelling:'덩어리 찾는 중… {a}%',
   deleteAgain:'Delete를 한 번 더 누르면 프로젝트 전체에서 프레임 {n}개를 삭제합니다 (Ctrl+Z로 되돌리기).',deleted:'프레임 {n}개 삭제 — Ctrl+Z로 되돌리기',
   errorTitle:'자를 수 없습니다',gridColour:'픽셀 색으로 찾음'
  },
  tile:{
   confirmBanner:'추천 격자 {w}×{h} (신뢰도 {conf}) — 선이 시트와 맞는지 확인하세요.',confirm:'격자가 맞습니다',
   lowBanner:'확신할 만한 격자를 찾지 못했습니다. 지금 선은 수동 크기입니다. 추천 중에서 고르거나 타일 크기를 입력하세요.',
   confidenceLabel:'신뢰도',layoutReason:'{layout} 템플릿과 같은 배치',contentBlank:'빈 칸 {n}개',contentEdges:'타일 가장자리 {n}%가 반복',
   templateArt:'내 시트가 아니라 템플릿 그림을 보여 주고 있습니다: {why}.',whyShort:'시트에는 타일이 {n}개인데 이 규칙은 {total}개가 필요',whyGrid:'격자가 아직 확인되지 않음',whyChosen:'템플릿 그림을 선택함',
   mapMissing:'타일이 없는 칸 {n}개',sheetMissing:'규칙에 필요한 슬롯 {n}개가 시트에 없습니다',mismatch:'슬롯 모양과 맞지 않는 타일 {n}개',
   mismatchLine:'슬롯 {i}: {sides} 쪽이 규칙과 맞지 않음',mapComplete:'모든 칸을 내 시트의 타일로 그렸고, 규칙 검사에서도 빠진 것이 없습니다.',
   rulesMismatch:'슬롯과 맞지 않아 보이는 타일 {n}개'
  },
  plab:{
   verdictResampled:'≈{s}배로 리샘플링됨 — 정수 배율의 도트 격자가 아닙니다',resampledInteger:'≈{s}배이지만 부드럽게 보간됨: 픽셀을 복사한 것이 아니라 섞었습니다',
   resampledNote:'{kind} · 신뢰도 {conf}. 원래 픽셀을 정확히 되살릴 수 없습니다. ≈{w}×{h}로 최근접 축소를 해도 근사치일 뿐입니다.',
   smoothed:'부드럽게 보간됨(바이리니어 등)',notSmoothed:'폭이 고르지 않은 블록(소수 배율의 최근접 확대)'
  },
  texture:{
   heightSource:'높이 맵',heightAuto:'{name} (높이로 분류됨)',heightChosen:'{name}',heightMissing:'높이 맵으로 분류된 파일이 없습니다. 높이가 담긴 파일을 고르세요.',
   heightWrong:'{name}은(는) 높이가 아니라 {role}(으)로 분류되었습니다. 이 파일로 만든 노멀 맵은 표면이 아니라 색을 따라갑니다.',
   heightPick:'고르기…',addedToSet:'{name}을(를) 세트에 추가했습니다 — 미리보기에서 사용합니다.',addToSet:'세트에 추가',
   generatedNote:'여기서 생성'
  },
  uiLab:{
   fontDetected:'격자 {cw}×{ch} · {cols}×{rows}칸 · {order} · 신뢰도 {conf}',fontOrders:{ascii:'공백(32)부터 ASCII',ascii33:'"!"(33)부터 ASCII',cp437:'코드 페이지 437 (0–255)'},
   fontUndetected:'눈에 띄는 글자 격자가 없습니다. 칸 크기와 글자 순서를 입력하세요.',fontApplyDetected:'찾은 격자 사용',
   guideUndo:'안내선 이동 되돌리기',guideRedo:'다시 실행'
  },
  atlas:{
   animations:'애니메이션',animationsFound:'파일 이름에서 애니메이션 {n}개',animationAll:'모든 프레임',
   canvasNote:'크기가 다른 프레임을 {w}×{h} 공통 캔버스(아래 가운데 정렬)에 두고 데이터 파일에도 그렇게 적어, 재생할 때 튀지 않습니다.'
  },
  pswap:{
   drop:'스프라이트나 타일셋을 놓으세요',dropHint:'이미지에서 팔레트를 읽습니다 · 여러 색을 한 번에 바꾸기 · 업로드 없음',
   palette:'이미지 속 색',paletteCount:'{n}색',paletteMore:'+{n}색 더',pick:'이미지에서 고르기',pickHint:'이미지의 픽셀이나 견본을 클릭하면 그 색을 바꿉니다.',
   swaps:'바꿀 색',addSwap:'+ 바꿀 색 추가',removeSwap:'빼기',from:'원래 색',to:'새 색',tolerance:'비슷한 색 허용 범위',shading:'명암 유지',noSwaps:'바꿀 색을 골라 시작하세요.',
   run:'다운로드',runMany:'이미지 {n}장 다운로드 (ZIP)',changed:'{n}픽셀이 바뀝니다',done:'저장 완료 ({size})',before:'원본',after:'바꾼 결과',zoom:'확대',sample:'샘플 스프라이트'
  }
 },
 ja:{
  confidence:{high:'高',medium:'中',low:'低'},
  lab:{
   keyApplied:'背景色{hex}を透明にしました · 信頼度{conf}',keySuggest:'このシートは{hex}の背景の上にあるようです（信頼度{conf}）。',
   keyUse:'透明にする',keyOff:'背景のままにする',keyWhy:'根拠',
   sliceHint:'クリックで選択 · Shift+クリックで範囲選択 · Ctrl/⌘+クリックで1つずつ追加・解除 · ドラッグで移動、空いた所をドラッグで追加、角のハンドルでサイズ変更 · Deleteで削除（Ctrl+Zで元に戻す）。',
   mergeWhy:{single:'シート全体が1つにつながった塊です — グリッドを使うか、先に背景色を消してください',apart:'{until}px以内に近い塊がないため、それぞれをフレームとします'},
   islandsAttached:'小さな部品{n}個（{px}px）を隣のフレームに付けました',
   islandsUnassigned:'小さな部品{n}個（{px}px）がどのフレームにも入っていません',
   islandsShow:'表示',islandsHide:'隠す',islandsAttach:'最も近いフレームに付ける',islandsAdd:'フレームとして追加',
   gridHint:'フレーム同士が接しています: 自動では塊{auto}個、{w}×{h}グリッド（信頼度{conf}）では{grid}フレームです。',useGrid:'グリッドを使う',
   labelling:'塊を検出中… {a}%',
   deleteAgain:'もう一度Deleteを押すと、プロジェクト全体からフレーム{n}個を削除します（Ctrl+Zで元に戻せます）。',deleted:'フレーム{n}個を削除 — Ctrl+Zで元に戻す',
   errorTitle:'分割できません',gridColour:'ピクセルの色から検出'
  },
  tile:{
   confirmBanner:'おすすめのグリッド{w}×{h}（信頼度{conf}）— 線がシートと合っているか確認してください。',confirm:'グリッドは正しい',
   lowBanner:'確信できるグリッドは見つかりませんでした。今の線は手動のサイズです。候補から選ぶか、タイルサイズを入力してください。',
   confidenceLabel:'信頼度',layoutReason:'{layout}テンプレートと同じ配置',contentBlank:'空のセル{n}個',contentEdges:'タイルの辺の{n}%が繰り返し',
   templateArt:'あなたのシートではなくテンプレートの絵を表示しています: {why}。',whyShort:'シートのタイルは{n}個、このルールには{total}個必要',whyGrid:'グリッドがまだ確認されていません',whyChosen:'テンプレートの絵を選択中',
   mapMissing:'タイルのないセル{n}個',sheetMissing:'ルールに必要なスロット{n}個がシートにありません',mismatch:'スロットの形に合わないタイル{n}個',
   mismatchLine:'スロット{i}: {sides}側がルールと合いません',mapComplete:'すべてのセルをあなたのシートのタイルで描き、ルールチェックでも不足はありません。',
   rulesMismatch:'スロットに合わないように見えるタイル{n}個'
  },
  plab:{
   verdictResampled:'≈{s}倍にリサンプリング — 整数倍のドット格子ではありません',resampledInteger:'≈{s}倍ですが補間されています: ピクセルをコピーではなく混ぜています',
   resampledNote:'{kind} · 信頼度{conf}。元のピクセルは正確には復元できません。≈{w}×{h}への最近傍縮小も近似にすぎません。',
   smoothed:'なめらかに補間（バイリニアなど）',notSmoothed:'幅の不ぞろいなブロック（小数倍の最近傍拡大）'
  },
  texture:{
   heightSource:'ハイトマップ',heightAuto:'{name}（ハイトに分類）',heightChosen:'{name}',heightMissing:'ハイトマップに分類されたファイルがありません。高さを持つファイルを選んでください。',
   heightWrong:'{name}はハイトではなく{role}に分類されています。これから作るノーマルマップは表面ではなく色をなぞります。',
   heightPick:'選択…',addedToSet:'{name}をセットに追加しました — プレビューで使います。',addToSet:'セットに追加',
   generatedNote:'ここで生成'
  },
  uiLab:{
   fontDetected:'グリッド{cw}×{ch} · {cols}×{rows}セル · {order} · 信頼度{conf}',fontOrders:{ascii:'スペース(32)からのASCII',ascii33:'"!"(33)からのASCII',cp437:'コードページ437（0–255）'},
   fontUndetected:'目立つ文字グリッドが見つかりません。セルサイズと文字順を入力してください。',fontApplyDetected:'検出したグリッドを使う',
   guideUndo:'ガイドの移動を元に戻す',guideRedo:'やり直す'
  },
  atlas:{
   animations:'アニメーション',animationsFound:'ファイル名からアニメーション{n}個',animationAll:'すべてのフレーム',
   canvasNote:'サイズの違うフレームを{w}×{h}の共通キャンバス（下中央揃え）に置き、データファイルにもそう書くので、再生時にぶれません。'
  },
  pswap:{
   drop:'スプライトやタイルセットをドロップ',dropHint:'画像からパレットを読み取ります · 複数の色をまとめて置き換え · アップロードなし',
   palette:'画像の中の色',paletteCount:'{n}色',paletteMore:'+{n}色',pick:'画像から選ぶ',pickHint:'画像のピクセルか色見本をクリックすると、その色を置き換えます。',
   swaps:'置き換える色',addSwap:'+ 置き換えを追加',removeSwap:'外す',from:'元の色',to:'新しい色',tolerance:'近い色の許容範囲',shading:'陰影を保つ',noSwaps:'置き換える色を選んで始めてください。',
   run:'ダウンロード',runMany:'画像{n}枚をダウンロード（ZIP）',changed:'{n}ピクセルが変わります',done:'保存しました（{size}）',before:'元画像',after:'置き換え後',zoom:'拡大',sample:'サンプルスプライト'
  }
 }
};
for(const [locale,table] of Object.entries(TRUST_STRINGS))if(S[locale])merge(S[locale],table);
