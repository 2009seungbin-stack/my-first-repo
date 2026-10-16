/** Preflight follows the existing intent-content contract. Build-time prose only.
 * Names, examples and limitations are specific to the inventory type, not claims of vendor support. */
import {text} from '../preflight/messages.js';
const LABELS={preflight:'Nerulio Preflight',obs:'OBS Preflight',studio:'Studio Preflight',blender:'Blender Preflight',godot:'Godot Preflight'};
const ANSWERS={
 preflight:[
  'Nerulio Preflight checks whether the components in your creative setup are ready for a version change. Choose OBS, a music production stack, Blender or Godot, enter the current and target version, then add a list or import an inventory JSON. The local report returns a clear upgrade verdict, source confidence and the actions to review first. Catalog entries without verified target evidence remain unknown.',
  '네룰리오 사전 검사는 창작 환경의 업그레이드 영향을 확인합니다. 방송 도구, 음악 제작 환경, 블렌더나 고도를 선택하고 현재 버전과 목표 버전, 구성 요소를 입력하세요. 목록을 한꺼번에 붙여넣거나 설치 목록 파일을 가져올 수 있습니다. 브라우저 안에서 판정과 근거, 필요한 조치를 생성하며 검증 정보가 없는 제품은 확인 불가로 남깁니다.',
  'ネリュリオの事前チェックは制作環境の更新による影響を確認します。配信、音楽制作、Blender、Godotから選び、現在と目標の版、構成を入力してください。リストの一括入力や構成ファイルの読み込みも利用できます。ブラウザ内で判定、根拠、必要な対応を生成し、確認済み情報がない製品は不明のまま表示します。',
 ],
 obs:[
  'OBS Preflight evaluates an OBS plugin inventory against a target OBS version. It combines declared component version requirements with Windows installation layout observations, binary architecture and required dependencies. The report separates an unverified plugin from a known loading failure. Real OBS installation rules include official sources; fictional sample plugins demonstrate the report without claiming that real products support OBS 33.',
  '방송 환경 사전 검사는 현재와 목표 방송 프로그램 버전을 비교합니다. 설치된 플러그인의 최소 버전, 윈도우 설치 구조, 바이너리 아키텍처와 필수 의존성을 함께 확인합니다. 아직 검증되지 않은 제품과 근거가 있는 로딩 실패를 구분합니다. 실제 설치 경로 규칙에는 공식 출처가 연결되며 가상 플러그인 샘플은 실제 제품의 새 버전 지원을 의미하지 않습니다.',
  '配信環境のチェックは現在と目標のOBS版を比較します。プラグインの最低版、Windowsの設置構造、バイナリの構成と必須依存関係を確認します。未確認の製品と根拠のある読み込み障害を区別します。実際の設置規則には公式出典が付いており、架空のサンプルは実製品の新版への対応を意味しません。',
 ],
 studio:[
  'Studio Preflight evaluates a music production inventory before an operating-system update. Include the DAW, audio interface, drivers, control software, license managers and audio plugins, not just VST files. Specify the target architecture, available plugin formats and runtimes. Dependencies and source-backed native or Rosetta requirements influence the report. The initial catalog needs additional vendor statements before real product compatibility can be affirmed.',
  '音楽制作の事前チェックはOS更新前に制作構成を評価します。音声プラグインだけでなく、DAW、インターフェイス、ドライバー、制御ソフトとライセンス管理を追加してください。目標のアーキテクチャ、形式、ランタイムを指定します。依存関係や確認済みの実行条件を判定に反映します。実製品の互換性を確認するにはベンダーの根拠を追加する必要があります。',
  '음악 제작 사전 검사는 운영체제 업그레이드 전에 제작 환경 전체를 평가합니다. 오디오 플러그인뿐 아니라 작곡 프로그램, 오디오 인터페이스, 드라이버, 제어 프로그램과 라이선스 관리자를 추가하세요. 목표 아키텍처와 지원 형식, 런타임을 지정하면 근거가 있는 실행 조건과 의존성을 판정에 반영합니다. 실제 제품의 호환성을 확정하려면 제작사의 검증 근거를 더 수집해야 합니다.',
 ],
 blender:[
  'Blender Preflight checks an entire creator stack before a Blender upgrade. Include add-ons, extensions, Geometry Nodes packs, render engines, Python tools, asset libraries and export tools. The engine compares numeric versions correctly even when the target has an LTS label. Verified Python/runtime and API requirements can block a dependant or recommend waiting. The fictional sample is useful for learning the workflow; real add-on support still requires scoped primary-source records.',
  '블렌더 사전 검사는 엔진 업그레이드 전에 제작 환경 전체를 확인합니다. 애드온, 확장, 지오메트리 노드 팩, 렌더 엔진, 파이썬 도구와 내보내기 도구를 함께 추가하세요. 장기 지원 태그가 있어도 숫자 버전을 정확히 비교합니다. 확인된 런타임과 함수 변경 조건은 의존성에도 영향을 줍니다. 가상 샘플은 사용 흐름을 보여주며 실제 제품 지원은 제작사의 범위가 명시된 근거가 필요합니다.',
  'Blenderの事前チェックはエンジン更新前に制作構成全体を確認します。アドオン、拡張、ノードパック、レンダー、Python、出力ツールを追加してください。長期サポート表記があっても数字の版を正しく比較します。確認済みのランタイムと機能変更は依存先にも影響します。架空のサンプルは使い方を示し、実製品への対応には範囲を明記した公式情報が必要です。',
 ],
 godot:[
  'Godot Preflight checks the project stack before an engine update. Add editor plugins, GDExtensions, dialogue and terrain tools, native libraries and export templates; specify the renderer, scripting mode and .NET runtime when applicable. Required dependencies propagate failures through the stack, while absent evidence remains unknown. The sample demonstrates unresolved API changes without asserting that GodotSteam, Terrain3D or another real project supports an unverified target.',
  '고도 사전 검사는 엔진 업데이트 전에 프로젝트 환경을 확인합니다. 에디터 플러그인, 네이티브 확장, 대화·지형 도구와 내보내기 템플릿을 추가하고 렌더러와 스크립트 방식, 필요한 런타임을 지정하세요. 필수 의존성의 실패는 상위 구성 요소에도 반영되며 근거가 없으면 확인 불가로 남습니다. 가상 샘플은 미해결 함수 변경을 보여줄 뿐 실제 제품이 새 엔진을 지원한다고 주장하지 않습니다.',
  'Godotの事前チェックはエンジン更新前にプロジェクト環境を確認します。エディタープラグイン、ネイティブ拡張、会話・地形ツール、出力テンプレートを追加し、レンダラー、言語、必要なランタイムを指定してください。必須依存先の障害は上位にも反映し、根拠がなければ不明のままです。架空のサンプルは未解決の変更を示すもので、実製品への新エンジン対応を主張しません。',
 ],
};
// Keep the common locale ordering en/ko/ja. Studio copy is deliberately reordered explicitly.
const studioKo=ANSWERS.studio[2];ANSWERS.studio[2]=ANSWERS.studio[1];ANSWERS.studio[1]=studioKo;
const EXAMPLES={
 preflight:['Choose a vertical, then load its clearly marked fictional sample and compare another target.','환경 종류를 선택하고 가상 샘플을 불러온 뒤 다른 목표 버전과 비교하세요.','構成の種類を選び、架空サンプルを読み込んで別の目標版と比較してください。'],
 obs:['A fictional OBS 32.2.2 inventory targeting 33 includes an old plugin version and an unverified filter. These require an update and vendor verification respectively.','가상 방송 환경은 현재 32.2.2에서 목표 33으로 바뀝니다. 구형 플러그인은 업데이트를, 미확인 필터는 제작사 확인을 요구합니다.','架空の配信構成は32.2.2から33へ更新します。古いプラグインは更新が必要で、未確認フィルターはベンダー確認が必要です。'],
 studio:['A fictional music Mac changes from OS 15 to 26. Its driver is blocked and its audio plugin needs a translated execution mode; the report does not approve the upgrade.','가상 음악 작업 환경의 운영체제가 15에서 26으로 바뀝니다. 필수 드라이버가 차단되어 있고 플러그인의 번역 실행 조건도 있어 업그레이드를 승인하지 않습니다.','架空の音楽環境はOS 15から26へ更新します。必須ドライバーがブロックされ、プラグインに変換実行の条件もあるため更新は承認されません。'],
 blender:['A fictional Blender 4.5 LTS stack targets 5.2 LTS with a Python runtime requirement and an unresolved renderer API change. The sample verdict recommends waiting.','가상 블렌더 제작 환경은 장기 지원 4.5에서 5.2로 바뀝니다. 파이썬 런타임 요건과 해결되지 않은 렌더러 함수 변경 때문에 대기를 권고합니다.','架空のBlender構成は長期サポート4.5から5.2へ更新します。Python要件と未解決のレンダー機能変更があり、サンプルの判定は待機です。'],
 godot:['A fictional Godot 4.6 project targets 4.7. Its native extension has no fix for an API change; renderer and runtime choices must also be verified before exporting.','가상 고도 프로젝트는 엔진 4.6에서 4.7로 바뀝니다. 네이티브 확장의 함수 변경 해결책이 없으며 내보내기 전에 렌더러와 런타임도 확인해야 합니다.','架空のGodotプロジェクトは4.6から4.7へ更新します。ネイティブ拡張の変更に修正がなく、出力前にレンダラーとランタイムの確認も必要です。'],
};
const TROUBLE={
 en:[
  ['Unknown compatibility','No verified statement matches the target','Read the vendor link and installed version','Keep the verdict cautious until verified'],
  ['Dependency failure','A required runtime is missing or blocked','Open the component dependency section','Resolve the dependency before upgrading'],
  ['JSON rejected','Wrong vertical or unsupported inventory schema','Check schemaVersion, host and component IDs','Export a version 1 inventory for this vertical'],
 ],
 ko:[
  ['호환성 확인 불가','목표 범위에 일치하는 검증 근거 없음','제작사 출처와 설치 버전을 확인','근거를 확인할 때까지 주의 판정 유지'],
  ['의존성 실패','필수 런타임이 없거나 차단됨','구성 요소의 의존성 상세 보기','업그레이드 전에 의존성을 해결'],
  ['파일 가져오기 실패','환경 종류나 스키마 버전이 다름','파일 형식과 호스트·구성 요소 식별자 확인','해당 환경의 첫 번째 형식으로 내보내기'],
 ],
 ja:[
  ['互換性が不明','目標範囲に一致する確認済み根拠がない','出典とインストール版を確認','根拠を確認するまで注意判定を維持'],
  ['依存関係の障害','必須ランタイムがないかブロックされる','構成要素の依存関係詳細を開く','更新前に依存関係を解決'],
  ['ファイルを読み込めない','構成種類や形式の版が違う','形式、ホスト、識別子を確認','対応する最初の形式で書き出す'],
 ],
};
const pages={};
for(const [id,name] of Object.entries(LABELS)){
 const p=id==='preflight'?'preflight':'preflight/'+id;
 const entry={type:'tool',intent:{primary:'check the upgrade readiness of '+name,goal:'a source-grounded upgrade verdict and an ordered local report',
  input:'current and target versions plus an inventory JSON or component list',output:'local verdict, reasons, dependency findings, JSON and printable HTML',
  support:'partial',evidence:['src/preflight/core/engine.js','tests/preflight.test.mjs','tests/preflight-browser.py']}};
 for(const [i,l] of ['en','ko','ja'].entries()){
  const t=k=>text(l,k),prefix=id==='preflight'?(l==='ko'?'사전 검사':l==='ja'?'事前チェック':'Preflight'):id==='studio'?(l==='ko'?'음악 환경':l==='ja'?'音楽構成':'Music stack'):id==='blender'?(l==='ko'?'블렌더 환경':l==='ja'?'Blender構成':'Blender stack'):id==='godot'?(l==='ko'?'고도 환경':l==='ja'?'Godot構成':'Godot stack'):'OBS';
  entry[l]={answer:ANSWERS[id][i],
   concept:{body:[prefix+': '+t('readyOnly'),prefix+': '+t('confidenceHelp')]},
   example:{lead:[EXAMPLES[id][i]],lines:[id==='preflight'?'Input inventory → local verdict → export':id==='obs'?'SAMPLE: 32.2.2 → 33':id==='studio'?'SAMPLE: macOS 15 → 26':id==='blender'?'SAMPLE: Blender 4.5 LTS → 5.2 LTS':'SAMPLE: Godot 4.6 → 4.7']},
   verify:{steps:[prefix+': '+t('realWarning'),prefix+': '+t('privacy')]},
   trouble:{rows:TROUBLE[l].map(row=>[prefix+' · '+row[0],...row.slice(1)])},
   alternatives:{rows:[[l==='ko'?'제작사 문서':l==='ja'?'ベンダーの文書':'Vendor documentation',prefix+': '+t('reason.verifyComponent',{name})]]},
   limits:{items:[prefix+': '+t('sampleWarning'),prefix+': '+t('scannerHelp')]},
  };
 }
 pages[p]=entry;
}
export default pages;
