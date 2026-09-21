import {getLocale} from './i18n.js';
const words={
 advanced:['고급','Advanced','詳細'],resetCrop:['전체 영역 선택','Select full image','画像全体を選択'],
 percent:['비율 · %','Scale · %','拡大縮小 · %'],longSide:['긴 변 · px','Longest side · px','長辺 · px'],
 megapixels:['총 픽셀 · MP','Megapixel target','画素数 · MP'],
 sr:['ML 초해상도 · 실험 · 모델 다운로드','ML super-resolution · experimental · model download','ML超解像 · 実験版 · モデル取得'],
 general:['AI 일반 피사체 · 실험','AI subjects · experimental','AI一般被写体 · 実験版'],
 matteNote:['사람·사물용 실험 모델입니다. 처음 실행하면 약 183MB 모델을 내려받습니다. 머리카락·털·투명 제품의 품질은 아직 검증 중입니다.','Experimental person/object model. First run downloads about 183 MB. Hair, fur and transparent-product quality are still being validated.','人物・物体向けの実験モデルです。初回は約183MB取得します。髪・毛・透明製品の品質は検証中です。'],
 palette:['고정 팔레트 · 한 줄에 #RRGGBB 또는 GIMP 팔레트','Locked palette · #RRGGBB per line or GIMP palette','固定パレット · 1行に#RRGGBB、またはGIMP形式'],
 ditherMode:['디더링 방식','Dithering method','ディザ方式'],
 resampling:['고품질 타일 보간입니다. AI 디테일 복원은 별도 실험 경로입니다. 지원 크기는 기기·브라우저에 따라 다릅니다.','High-quality tiled resampling. ML detail reconstruction is a separate experimental path. Output capacity depends on your device and browser.','高品質タイル補間です。MLによる細部復元は別の実験的処理です。出力サイズは端末とブラウザに依存します。'],
 keyboard:['방향키: 1px 이동 · Shift: 10px · Alt: 크기 조절','Arrow keys: move 1px · Shift: 10px · Alt: resize','矢印キー: 1px移動 · Shift: 10px · Alt: サイズ変更']
};
export const imageLabel=key=>words[key][{ko:0,en:1,ja:2}[getLocale()]];
