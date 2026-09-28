// @ts-check
/** MANUAL_SOURCE: official anime/game news that has no feed — premiere dates, Korean streaming and
 * theatrical dates, casts, game version notices on client-rendered official sites.
 *
 * Why manual: Japanese anime official sites publish news as HTML without RSS; Korean distributors announce on
 * their own sites or official social accounts; HoYoverse/Kakao Games official sites render client-side and
 * their JSON endpoints are undocumented (we do not call undocumented endpoints). Automated coverage exists
 * only where a documented/observed feed does: `steam-news-subculture` (publisher posts on Steam) and
 * `anilist-schedule` (third-party, COMMUNITY-labelled signal that tells curators what to re-check).
 */
export default {
 id:'subculture-official-news',
 vertical:'subculture',
 mode:'manual',
 freshnessHours:72,
 hosts:[],
 minIntervalMs:0,
 terms:'Official sites only; respect robots.txt; read client-rendered pages in a browser. Undocumented JSON endpoints are not used.',
 channels:[
  'Japanese anime official sites: /news/, /onair/, /cast/, /staff/ pages (Japanese premiere dates/times, broadcasters, cast)',
  'Korean distributors and streaming services: Aniplus, Daewon Media/Anibox, Laftel, Netflix Korea, TVING, Crunchyroll — official site or official X account',
  'Korean cinema chains (CGV, Megabox, Lotte Cinema) movie pages for Korean theatrical dates',
  'Game official notice pages: genshin.hoyoverse.com/ko/news, hsr.hoyoverse.com/ko-kr/news, zenless.hoyoverse.com, forum.nexon.com/bluearchive, umamusume.kakaogames.com',
 ],
 workflow:[
  'When anilist-schedule or steam-news-subculture reports a change, open the official page and confirm before writing an OFFICIAL fact.',
  'Korean titles: copy the exact title used by the Korean distributor/streamer; never transliterate on our own.',
  'Dates: keep the source precision; Japanese broadcast times in +09:00, Korean in +09:00 with region KR.',
 ],
 async collect(){throw Error('manual adapter: maintained by curators');},
};
