# 선택 기능의 외부 의존성

기본 UI, Canvas 이미지 편집, 팔레트/디더링, ZIP/GIF 코드는 이 저장소 안에 있습니다. 다음 항목은 선택 기능에서만 원격으로 불러옵니다. 버전은 코드에 고정했지만 모델 가중치는 호스트에서 변경될 수 있습니다. 출시 전 라이선스, 보안 업데이트, 실제 브라우저 호환성을 다시 검토하세요.

| 용도 | 라이브러리/모델 | 출처 | 표시된 라이선스 |
| --- | --- | --- | --- |
| PDF 조작 | pdf-lib 1.17.1 | https://github.com/Hopding/pdf-lib | MIT |
| PDF 표시 | PDF.js/pdfjs-dist 4.10.38 | https://github.com/mozilla/pdf.js | Apache-2.0 |
| HEIC 디코딩 | heic2any 0.0.4 | https://github.com/alexcorvi/heic2any | MIT; 포함 코덱의 조건 별도 확인 |
| 브라우저 모델 실행 | Transformers.js 3.7.2 | https://github.com/huggingface/transformers.js | Apache-2.0 |
| 인물 매팅 | Xenova/modnet | https://huggingface.co/Xenova/modnet | 모델 카드 Apache-2.0 |
| MP3 인코딩 | lamejs 1.2.1 | https://github.com/zhuker/lamejs | LGPL-3.0; 배포 시 관련 의무 검토 |

제삼자 라이브러리·모델·폰트 파일은 저장소에 복사하지 않습니다. 시스템 폰트를 사용하며 PDF의 추가 텍스트는 Canvas 이미지로 렌더링합니다. CDN은 jsDelivr, 모델 호스트는 Hugging Face입니다. 캐시가 지워지면 다시 다운로드할 수 있습니다.

AI 인물 제거는 WASM CPU 단일 스레드로 요청합니다. WebGPU가 필수인 서비스가 아닙니다. 모델은 사용자 클릭 후에만 로드됩니다. 이번 제한 환경에서는 이 외부 경로의 성공을 실제로 검증하지 못했으므로 출시 전 실행 검증이 필요합니다.

`_headers`는 이를 지원하는 정적 호스팅용 예시입니다. 모든 호스트가 이 파일을 적용하지는 않습니다. 외부 리소스/CSP 호환성과 HTTPS 제공 여부를 실제 배포 환경에서 확인하세요. CSP 자체가 제삼자 코드의 무해함을 보증하지는 않습니다.
