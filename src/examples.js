import {EXAMPLES} from './example-data.js';
import {esc} from './ui.js';
export {EXAMPLES};
export function exampleHTML(id,locale) {
  const example=EXAMPLES[id];if(!example)return '';
  const l={en:['Example','Original geometric sample','Processed sample','Example generated with this tool. ZIP tools show their preview; inspect the downloaded archive for every file.'],ko:['예제','원본 도형 샘플','도구로 처리한 샘플','이 도구로 만든 예제입니다. ZIP 도구는 미리보기를 표시하며 전체 파일은 내려받은 압축 파일에서 확인하세요.'],ja:['使用例','元の図形サンプル','処理後のサンプル','このツールで作成した例です。ZIPツールはプレビューを表示します。すべてのファイルはダウンロードしたZIPで確認してください。']}[locale];
  return `<section class="tool-examples"><h3>${l[0]}</h3><div class="example-pair">${['before','after'].map((key,i)=>{const v=example[key];return `<figure><img src="assets/examples/${esc(v.file)}" width="${v.width}" height="${v.height}" alt="${esc(l[i+1])} · ${v.width} × ${v.height}" loading="lazy" decoding="async"><figcaption>${l[i+1]} · ${v.width} × ${v.height}</figcaption></figure>`;}).join('')}</div><p>${l[3]}</p></section>`;
}
