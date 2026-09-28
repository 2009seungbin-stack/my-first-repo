export default {
 'audio-lab': {
  type: 'tool',
  intent: {
   primary: 'analyze the tempo and musical key of a local audio file, trim a waveform, edit speed and pitch, measure loudness, and export a ringtone-sized clip',
   goal: 'a locally edited WAV, Ogg Vorbis or MP3 file with a separately displayed tempo and key estimate and loudness measurement',
   input: 'one local audio file up to three minutes, two channels and 128 MiB',
   output: 'WAV PCM 16-bit, Ogg Vorbis or MP3; iPhone M4R is disabled pending verification',
   support: 'partial',
   evidence: ['src/audio-lab/analysis.js', 'src/audio-lab/dsp.js', 'src/audio-lab/worker.js', 'tests/audio-lab.test.mjs'],
  },
  en: {
   answer: 'Nerulio Audio Lab estimates BPM and major or minor key from a file you choose on your device. It can cut a waveform range, trim quiet edges, add fades, change playback speed and pitch separately, measure integrated LUFS, and save WAV, Ogg Vorbis or MP3. The estimates include confidence because a beat can be heard at half or double time and a song can change key. Editing and encoding happen inside this browser. iPhone M4R remains disabled until AAC in MP4 and phone playback have been verified.',
   concept: {body: ['The worker reads decoded samples locally. Spectral onset strength and autocorrelation estimate tempo; chroma and major/minor profiles estimate key. These are estimates, especially for speech, weak percussion or changing harmony.', 'A K-weighted, gated meter estimates integrated loudness. The displayed peak is the sample peak, not an oversampled true peak. A normalization target is limited by a −1 dBFS sample-peak ceiling.']},
   example: {lead: ['For a 16 second test clip constructed with 120 BPM clicks and C major chords, the analyzer reports a tempo near 120 BPM and C major while exposing half-time as another possible pulse. Choose a ten second range, fade both ends, preview the WAV, then save the selected format.'], lines: ['120 BPM × 16 s = 32 beats']},
   verify: {steps: ['Check the displayed confidence and listen to the source against the beat and key estimate.', 'Play the exported clip in another audio application and check the start, ending and fade for clicks.', 'For loudness work, use an independent LUFS and true-peak meter before publishing.']},
   trouble: {rows: [
    ['Tempo is half or double','The rhythmic pulse is ambiguous','Compare the alternatives beneath BPM against the music','Use the value that matches counted beats'],
    ['Key is unknown','The file is short, percussive or lacks stable harmony','Listen for sustained chords and review confidence','Use a longer harmonic passage'],
    ['File cannot open','The browser cannot decode this codec or the file exceeds a local limit','Check duration, channels, size and the error in the status panel','Try a WAV or MP3 under three minutes'],
   ]},
   alternatives: {rows: [['A digital audio workstation','Use one when you need multitrack editing, manual note detection or mastering with true-peak metering']]},
   limits: {items: ['Maximum three minutes, stereo and 128 MiB input; some devices may have less usable memory.', 'Pitch and time stretching can introduce audible artifacts, particularly at large shifts.', 'M4R export and actual phone ringtone installation are unverified and disabled.']},
  },
  ko: {
   answer: 'Nerulio 오디오 랩은 기기에서 고른 파일의 BPM과 장조·단조를 추정합니다. 파형 구간을 자르고, 앞뒤 무음을 제거하고, 페이드를 넣고, 속도와 음높이를 따로 바꿀 수 있습니다. 통합 LUFS를 측정한 뒤 WAV, Ogg Vorbis 또는 MP3로 저장합니다. 박자는 절반이나 두 배로 들릴 수 있고 곡 중에 조성이 바뀔 수 있어 신뢰도를 함께 보여 줍니다. 편집과 인코딩은 브라우저 안에서 이뤄집니다. iPhone M4R은 AAC와 휴대전화 재생 검증 전까지 비활성입니다.',
   concept: {body: ['작업 스레드가 기기의 오디오 샘플을 읽습니다. 스펙트럼 시작점과 자기상관으로 템포를, 크로마와 장·단조 프로파일로 조성을 추정합니다. 말소리나 약한 타악, 전조가 있는 곡에서는 불확실합니다.', 'K 가중 및 게이트로 통합 라우드니스를 측정합니다. 표시된 피크는 샘플 피크이며 오버샘플한 트루 피크가 아닙니다. 목표 음량은 −1 dBFS 샘플 피크 상한에 따라 제한됩니다.']},
   example: {lead: ['120 BPM 클릭과 C장조 화음으로 만든 16초 테스트 파일에서는 120 BPM 근처와 C장조가 나오며 하프타임 후보도 보입니다. 10초 구간을 고르고 양쪽에 페이드를 넣어 WAV로 미리 듣고 원하는 형식으로 저장할 수 있습니다.'], lines: ['120 BPM × 16초 = 32박']},
   verify: {steps: ['신뢰도를 확인한 뒤 원곡을 들으며 박자와 조성을 대조합니다.', '내보낸 파일을 다른 재생기에서 열어 시작·끝·페이드의 잡음을 확인합니다.', '발행 전 별도 LUFS 및 트루 피크 측정기로 결과를 확인합니다.']},
   trouble: {rows: [
    ['BPM이 절반이나 두 배로 나옴','리듬 박자가 모호함','BPM 아래 다른 후보와 원곡을 비교','직접 센 박자와 맞는 값을 선택'],
    ['조성을 알 수 없음','파일이 짧거나 타악 위주 또는 화성이 불안정함','긴 화음 구간과 신뢰도 확인','화성이 있는 긴 구간 사용'],
    ['파일을 열 수 없음','브라우저의 코덱 미지원 또는 로컬 제한 초과','상태 오류와 길이·채널·용량 확인','3분 미만 WAV 또는 MP3 사용'],
   ]},
   alternatives: {rows: [['디지털 오디오 워크스테이션','여러 트랙 편집, 수동 음 탐지 또는 트루 피크 마스터링이 필요할 때']]},
   limits: {items: ['입력은 최대 3분, 스테레오, 128 MiB이며 기기별로 사용 가능한 메모리가 다릅니다.', '큰 속도·음높이 변화에는 들리는 아티팩트가 생길 수 있습니다.', 'M4R 저장 및 실제 휴대전화 벨소리 설치는 미검증이며 비활성입니다.']},
  },
  ja: {
   answer: 'Nerulioオーディオラボは端末で選んだファイルのBPMと長調・短調を推定します。波形の範囲を切り取り、前後の無音を除き、フェードを加え、速度と音程を別々に変えられます。統合LUFSを測定してWAV、Ogg Vorbis、MP3で保存します。拍は半分または倍の速度にも聞こえ、曲の途中でキーが変わることもあるため、信頼度を表示します。編集と符号化はブラウザー内で行います。iPhone M4RはAACと実機再生の検証まで無効です。',
   concept: {body: ['作業スレッドは端末内で復号した音声を読みます。スペクトルの立ち上がりと自己相関でテンポを、クロマと長短調のプロファイルでキーを推定します。話し声、弱い打楽器、転調を含む曲では不確かです。', 'K特性とゲートで統合ラウドネスを測ります。表示するピークはサンプルピークであり、オーバーサンプリングしたトゥルーピークではありません。目標音量には−1 dBFSのサンプルピーク上限を設けています。']},
   example: {lead: ['120 BPMのクリックとハ長調の和音で作った16秒のテスト音声では、約120 BPMとハ長調が表示され、半分のテンポも候補に残ります。10秒の範囲を選び、両端にフェードを付け、WAVで試聴してから形式を選んで保存します。'], lines: ['120 BPM × 16秒 = 32拍']},
   verify: {steps: ['信頼度を読み、原音を聴いて拍とキーを照らし合わせます。', '書き出した音声を別のプレーヤーで開き、始端・終端・フェードに雑音がないか確認します。', '公開前には別のLUFSとトゥルーピーク計で測定してください。']},
   trouble: {rows: [
    ['BPMが半分か倍になる','拍の解釈が曖昧','BPMの下にある候補と原音を比較','数えた拍に合う値を採用'],
    ['キーが不明','短い音声や打楽器中心、和声が不安定','長い和音部分と信頼度を確認','和声のある長い部分を使用'],
    ['ファイルを開けない','ブラウザーのコーデック非対応やローカル制限','状態表示と長さ・チャンネル・容量を確認','3分未満のWAVかMP3を使用'],
   ]},
   alternatives: {rows: [['デジタルオーディオワークステーション','複数トラック編集、手動採譜、トゥルーピークのマスタリングが必要な場合']]},
   limits: {items: ['入力は最大3分、ステレオ、128 MiBです。利用可能なメモリは端末によって異なります。', '速度や音程を大きく変えると可聴アーティファクトが生じます。', 'M4Rの保存と実機への着信音設定は未検証のため無効です。']},
  },
 },
};
