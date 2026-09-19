/* The movie catalog's data model, shared by tools/fshare-movie.mjs (which
   builds and validates it) and the Movie tab (which reads the sealed
   projection). Pure: no DOM, no fetch, no state — so both sides agree on what
   a link id is, what makes two rows the same title, and what a status means.

   One row per Fshare link, never per title. The id is the stored key that a
   check result hangs off, exactly as item_id is for progress; two links that
   share a title stay two rows and are grouped by `titleKey` at read time, so a
   renamed title can never orphan a status. */

export const MOVIE_DB_URL = '/data/fshare-movie/catalog.enc.json';
export const CATALOG_VERSION = 1;

/* pending: never checked · live/dead: the last check said so · unknown: the
   last check could not tell (timeout, 5xx, proxy down). Only pending is a
   "no answer yet" — an unknown is a real answer that needs another attempt. */
export const STATUSES = ['pending', 'live', 'dead', 'unknown'];

const LINK_RE = /(?:https?:\/\/)?(?:www\.)?fshare\.vn\/(file|folder)\/([A-Za-z0-9]{4,})(?=[/?#\s,;"')]|$)/gi;

export const linkId = (kind, code) => `fshare-${kind}-${String(code).toUpperCase()}`;
export const linkUrl = (kind, code) => `https://www.fshare.vn/${kind}/${String(code).toUpperCase()}`;

/** Every distinct Fshare link in a piece of text, canonicalised. */
export function extractFshareLinks(value) {
  const links = [];
  const seen = new Set();
  const text = String(value ?? '');
  LINK_RE.lastIndex = 0;
  let match;
  while ((match = LINK_RE.exec(text))) {
    const kind = match[1].toLowerCase();
    const code = match[2].toUpperCase();
    const id = linkId(kind, code);
    if (seen.has(id)) continue;
    seen.add(id);
    links.push({ id, kind, code, link: linkUrl(kind, code) });
  }
  return links;
}

/** Lowercase, diacritics stripped, đ folded — the same folding search uses.
    81% of names are plain ASCII and skip the normalize; plain toLowerCase()
    is identical to the 'vi' locale (only tr/az/lt lowercase differently) and
    twice as fast. Measured on 113k names: 305ms → 137ms per pass, and this
    runs several times per row at unlock. */
const ASCII = /^[\x00-\x7f]*$/;
export function fold(value) {
  const text = String(value || '');
  return (ASCII.test(text)
    ? text
    : text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  ).toLowerCase();
}

/**
 * What makes two rows "the same title". Leading list bullets (`- - `), release
 * punctuation (`.`, `_`, brackets) and a trailing file extension are noise;
 * the year is kept because `Dune (1984)` and `Dune (2021)` are different films.
 * Deliberately no quality-tag stripping: `1080p` vs `2160p` of one film are
 * near each other by sort already, and guessing further merges the wrong pair.
 */
export function titleKey(name) {
  return fold(name)
    .replace(/\.(mkv|mp4|avi|ts|m2ts|iso|srt|rar|zip)$/i, '')
    .replace(/^[\s\-–—·•*_.]+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/* What content a link actually is — not every Fshare share in these sources
   is a movie. `movie`/`software`/`music`/`document` split the one Movie
   tab into four, without touching the crawl/validate pipeline, which does
   not care what a link contains. Extension is decisive where a file carries
   one — the video, audio, app and document extensions below cover 99%+ of
   the 2026-09-18 catalog and never collide with a title. The remainder
   (folders, archive wrappers, bare titles) falls to name markers, and the
   markers come in two tiers because the same word means different things
   in different places:

   1. The tight tier applies to every name and is tuned for PRECISION over
      recall: bare, common English words ("action", "driver", "portable",
      "rock", "piano", "jazz", "blues", "opera", "vol") each matched real
      titles in the extension-less rows (Taxi Driver, Missing in Action,
      The Portable Door, The Rock, The Piano, Peking Opera Blues,
      Guardians of the Galaxy Vol. 2) and are not in it — a real movie
      missing from the Movie tab is worse than a stray link staying put.
      "crack" keeps only its bare form for the same reason: a word-boundary
      match already excludes "cracked", and "Vết Nứt Ám Hồn Trong Tranh -
      Cracked 2022" is a real film that showed up tagged software.
   2. The archive tier applies only to .rar/.zip/.7z/.iso/.nrg names that
      the tight tier left alone. Nobody wraps a film in a rar without also
      writing 1080p/BluRay/WEB-DL in the name (and those are caught first),
      so inside an archive the very same words — "album", "vol.2", "best
      of", "rock", "piano", "Artist - Title (1990)" — were music in every
      real row checked, and "ebook"/"tài liệu"/"hồ sơ thiết kế" were
      documents. The one film archive without release tags found, "Kill
      Bill Vol.1 ... BluRay.iso", is caught by the movie tier first.

   Underscores are folded to spaces before any marker runs: `_` is a word
   character to a regex, so "\\brevit\\b" never matched "3D_revit_office"
   and a JAV studio hidden in "Momota_1pondo_sh" was invisible to the adult
   check below. Unmarked and ambiguous rows default to `movie`, the
   majority case. A design work file (a Revit house, a 3ds Max scene, a
   drawing set) is a document — something opened and read — while the
   application, its plugins, presets and templates are software; that is
   why "tailieukientruc"/"hồ sơ thiết kế" are checked before "revit". */
export const CATEGORIES = ['movie', 'software', 'music', 'document'];
const VIDEO_EXT = new Set(['mkv', 'mp4', 'avi', 'ts', 'm2ts', 'wmv', 'mov', 'flv', 'rmvb', 'vob', 'mpg', 'mpeg', 'm4v', 'divx', 'webm', '3gp']);
const AUDIO_EXT = new Set(['mp3', 'flac', 'wav', 'm4a', 'wma', 'aac', 'dsf', 'ogg', 'ape', 'alac', 'opus']);
const APP_EXT = new Set(['exe', 'msi', 'apk', 'dmg', 'appimage', 'deb', 'ipa']);
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub', 'mobi', 'azw3', 'djvu', 'prc', 'cbr', 'cbz', 'rtf', 'odt', 'dwg', 'dxf', 'rvt', 'rfa', 'skp']);
const ARCHIVE_EXT = new Set(['rar', 'zip', '7z', 'iso', 'nrg', 'tar', 'gz']);
const MOVIE_MARKERS = /\b(1080p|2160p|720p|480p|4k|uhd|bluray|blu-ray|web[-.\s]?dl|webrip|hdtv|hdrip|dvdrip|remux|x264|x265|h\.?26[45]|hevc|dts(-hd)?|ddp\d?|atmos|complete|iqiyi|netflix|nf[.\s]web|amzn|s\d{2}e\d{2})\b/i;
const DOCUMENT_MARKERS = /\b(pdf(?!\s?(editor|reader|converter|creator|pro|architect|xchange|element|expert))|e-?books?|epub|tài liệu|tai lieu|giáo trình|giao trinh|dossier|luận văn|luan van|đề thi|de thi|toeic|ielts|bài giảng|bai giang|hồ sơ thiết kế|ho so thiet ke|bản vẽ|ban ve|tailieukientruc)\b/i;
const SOFTWARE_MARKERS = /-(codex|skidrow|reloaded|cpy|plaza|hoodlum|tenoke|rune|flt|razor1911|prophet|gog|darksiders|fpc)\b|\bcpy-|\bkhogamepc\b|\b(codex|skidrow|plaza|hoodlum|tenoke|razor1911|fitgirl|dodi|elamigos)-|\b(crackfix|full\s?crack|keygen|activator|repack|multilingual|ph[aầ]n\s?m[eề]m|setup|installer|incl\.?\s?dlc|full\s?dlc|adobe|photoshop|lightroom|premiere\s?pro|after\s?effects|illustrator|indesign|davinci\s?resolve|autocad|autodesk|solidworks|sketchup|revit|3ds\s?max|lumion|enscape|matlab|ansys|catia|archicad|etabs|vmware|virtualbox|windows\s?(7|8|10|11|xp)|win\s?(7|8|10|11|xp)|microsoft|office[\s._-]?(pro|plus|professional|365|20(03|07|10|13|16|19|21|24)|standard|home|enterprise|ltsc)|kmsauto|\bkms\b|anhdv|nhv[\s-]?boot|onekey\s?ghost|ghost\s?win|winpe|antivirus|kaspersky|bitdefender|\bidm\b|internet download manager|winrar|teamviewer|ultraiso|rufus|plugins?|overlays?|presets?|luts?|crack|viet\s?ho[aá]|việt\s?ho[aá]|linkneverdie|toithuthuat|fullcrackpc|hadoantv|bkshare|tech24h|khodohoa|cài[\s-]?đặt|cai[\s-]?dat|tuihocit|taimienphi|sinhvienit|designervn|videohive|graphicriver|envato|motion\s?array|macos|mac\s?os|v\d+\.\d+(\.\d+)*)\b/i;
const MUSIC_MARKERS = /\b(flac|wav|ost|soundtrack|lossless|karaoke|hi-?res|accuraterip|vinyl|16bit|24bit|96khz|tncd\d+|lvcd\d+|asia\d+cd\d+|nhạc (vàng|xuân|trẻ|xưa|việt|chọn lọc|trữ tình|sống)|cd nhạc|liên khúc|lien khuc|audiophile|sacd|xrcd|shm-cd|mqa|various artists|discography|greatest hits)\b|\[(16|24)-(44\.1|48|88\.2|96|176\.4|192)\]|\b24-(96|192)\b/i;
/* Archive tier — see the comment above: only for names the tight tier left
   alone, and only when the extension says archive. */
/* "Phim tài liệu" is a documentary and a folder of "Tài Liệu Sub Viet" is
   subtitled video: a video word anywhere in the name keeps a document
   marker from firing. */
const VIDEO_WORDS = /\b(phim|vietsub|sub\s?vi[eệ]t|thuyết minh|phụ đề|tập|tap|s\d{2})\b/i;
const ARCHIVE_DOCUMENT = /\b(books?|sách|sach|slides?|tutorials?|courses?|khóa học|khoa hoc|bài tập|bai tap|hồ sơ|ho so|thiết kế|thiet ke|kiến trúc|kien truc|nhà phố|nha pho|biệt thự|biet thu|mẫu nhà|mau nha|3d model|scene|3dsmax|3ds max|grammar|từ vựng|tu vung|ngữ pháp|ngu phap|giáo án|giao an)\b/i;
const ARCHIVE_SOFTWARE = /\b(x64|x86|32-?bit|64-?bit|portable|patch|serial|licen[cs]e|activat(e|ed|ion)|bootable|boot\s?(usb|disk|cd)|firmware|drivers?|android|apk|games?|steam|gog|goty|definitive edition|ultimate edition|topaz|blackmagic|nevercenter|3dvista|virtual tour|corel|coreldraw|cinema\s?4d|c4d|blender|zbrush|unity\s?(3d|hub)|unreal|vray|v-ray|corona render|jetbrains|intellij|pycharm|visual studio|xcode|sql server|oracle|arcgis|primavera|visio|excel|powerpoint|outlook|eset|norton|malwarebytes|ccleaner|7-zip|downloader|converter|recovery|retouch(ing)?|actions?|brushes|templates?|mockups?|fonts?|transitions?|openers?|titles?|lower thirds?|project files|xmp|dng|dlc|repack|cracked|full\s?(version|soft|unlocked)|santruongit|vngame|materials?|library|pbr|textures?|hdri|photo albums?|tiện ích|tien ich|cài win|cai win|foxit|acdsee|aescripts)\b|\b\d+\.\d+\.\d+(\.\d+)?\b/i;
const ARCHIVE_MUSIC = /\b(albums?|vol\.?\s?\d+|best of|piano|violin|guitar|jazz|blues|opera|concerts?|rock|sonatas?|symphon(y|ies)|concertos?|orchestra|quartet|ballads?|hits|singles|classical|acoustic|instrumental|live (in|at)|cd\s?\d{1,2}|\dcds?|nrg|dsd|nhạc|nhac|tuyển tập|tuyen tap|tình ca|tinh ca|bolero|nhạc vàng|nhac vang|nhạc trẻ|nhac tre|hòa tấu|hoa tau|mp3|dts|chopin|mozart|beethoven|bach|vivaldi|tchaikovsky|liszt|schubert|brahms|handel|haydn|debussy)\b|^\d{4} - |^[^-]{2,40} - .+\(\d{4}[^)]*\)|^[^-]{2,40} - .+\b(19|20)\d{2}\s*(\.|\(|$)/i;

function extOf(name) {
  const match = /\.([a-z0-9]{2,8})$/i.exec(String(name || '').trim());
  return match ? match[1].toLowerCase() : '';
}

/* `_` is a word character, so a marker at a word boundary never matched
   "3D_revit_office" or "Momota_1pondo_sh" until the underscores went; a dot
   between two letters is a scene-name space ("Paris.By.Night"), while one
   next to a digit ("v2.31", "h.264", "[24-44.1]") is left alone. */
function markerText(name) {
  return String(name || '').replace(/_/g, ' ').replace(/(?<=\p{L})\.(?=\p{L})/gu, ' ');
}

export function categoryOf(name) {
  const ext = extOf(name);
  if (VIDEO_EXT.has(ext)) return 'movie';
  if (AUDIO_EXT.has(ext)) return 'music';
  if (APP_EXT.has(ext)) return 'software';
  if (DOC_EXT.has(ext)) return 'document';
  const text = markerText(name);
  if (MOVIE_MARKERS.test(text)) return 'movie';
  const video = VIDEO_WORDS.test(text);
  if (!video && DOCUMENT_MARKERS.test(text)) return 'document';
  if (SOFTWARE_MARKERS.test(text)) return 'software';
  if (MUSIC_MARKERS.test(text)) return 'music';
  if (ARCHIVE_EXT.has(ext)) {
    if (ARCHIVE_SOFTWARE.test(text)) return 'software';
    if (!video && ARCHIVE_MUSIC.test(text)) return 'music';
    if (!video && ARCHIVE_DOCUMENT.test(text)) return 'document';
  }
  return 'movie';
}

/* Adult content shares the same crawled sources as everything else and does
   not get its own `category` — it belongs in the separate X dataset
   (public/fshare-tool/lib/x-db.js), not the Movie/Software/Music split
   above, so `tools/fshare-movie.mjs move-to-x` uses this to pull matching
   rows out of the movie catalog entirely (see docs/fshare-x-playbook.md's
   "moved-from-movie" transfer file). Studio/site names are the strongest,
   least ambiguous signal; explicit acts are next; a bare "xxx" is weakest
   and excluded by name for the one franchise that spells its title that way.
   SERIES_GUARD and KNOWN_TITLE_EXCLUDE exist because real titles collide
   with adult vocabulary more than any of the movie/software/music markers
   did: "Stepmom (1998)", "Hardcore Henry (2015)", the Korean dramas
   "Mischievous Kiss" ("...Little Vixen") and literally titled "Threesome"
   (season/episode numbering, guarded), the anime "Swallowed Star", the
   Netflix show "The End of the F***ing World", and the films "Orgasm Inc",
   "The Year I Started Masturbating" and "Don't Fuck in the Woods" — each
   found by checking real hits against the 2026-09-18 catalog, not guessed.
   `hardcore`, `stepmom/-sis/-dad/-bro`, bare `vixen` and `swallowed` were
   dropped as markers entirely rather than special-cased, since normal
   English usage of them is common and a false positive here means a real
   title silently vanishes from the Movie tab. A folder is worse again —
   `strict` below exists because one folder's meaningless "XXX" ("- - Paris
   by night Clollection 001 - XXX Update") would otherwise have cascaded
   `move-to-x` onto every real Paris By Night disc inside it. */
const ADULT_STUDIO_MARKERS = /\b(intheCrack|wowgirls|blacked(raw)?|tushy(raw)?|realitykings|reality[ .]kings|bangbros|digitalplayground|digital[ .]playground|marc[ .]dorcel|wickedpictures|evilangel|evil[ .]angel|metart|nubilefilms|nubile[ .]films|babes\.com|momsfamilysecrets|handsonhardcore|naughtyamerica|naughty[ .]america|brazzers|mofos|bangbus|teamskeet|povperv|myfamilypies|familystrokes|deeplush|pervmom|pervtherapy|21sextury|allanal|analvids|facialabuse|littlecaprice|clubseventeen|femjoy|watch4beauty|hegre|joymii|onlyfans|manyvids|thothub|elegantangel|newsensations|defloration|cum4k|dorcel|brattysis|teenslikeitbig|sexselector|1pondo|caribbeancom|carib|heyzo|tokyo-?hot|10musume|pacopacomama|s-cute|kin8(tengoku)?|mywife|gachinco|fc2-?ppv|model media|modelmedia|mdwp|asiansdoporn|asiansexdiary|legalporno|pornfidelity|pornworld|pornforce|porndude(casting)?|pornhub|hentaied|thaiswinger|youthlust|travelvids|hackcam|hack cam|javhd)\b/i;
const ADULT_EXPLICIT_MARKERS = /\b(blowjob|creampie|gangbang|deepthroat|cumshot|masturbat(e|ing|ion)?|orgasm|fuck(ed|ing)?|jerk(ed|ing)?\s?off|anal|dit nhau|địt|đụ|chich|chịch|nung lon|nứng|lồn(?! tiếng)|bu cu|bú cu|thu dam|thủ dâm|sex ?tape|clip sex|phim sex|lộ clip|ko che|không che)\b/i;
/* Weak, file-only signals (see `strict`): a bare word that real film titles
   also use — "Bad Luck Banging or Loony Porn" (2021), "After Porn Ends",
   Nikkatsu's "Angel Guts: Red Porno", "The Lowlife" (about a JAV actress),
   and "Nữ Chủ Nhà Dâm Đãng" (a Vivamax feature) are all folders in the
   real catalog. */
const ADULT_WEAK_MARKERS = /\b(xxx|jav|hentai|porno?|pornstar|dam dang|dâm đãng)\b/i;
/* JAV release codes: "SSNI-757", "JUQ-915_CUC HAY_…", "230ORECO-903",
   "FC2-PPV-4706057" — two to six letters, a dash, three or four digits,
   at the start of the name (a bracketed tag may precede it). Two-letter
   prefixes ("DV-1387.mp4") are accepted only when the code IS the name,
   because "MB-2019.zip" is a real archive and "AR-558" is a Star Trek
   episode. "DSD-512 Rhapsody In Blue" is a music catalogue number. */
const ADULT_JAV_CODE = /^\s*(\[[^\]]*\]\s*)?(\d{3}[a-z]{2,6}-\d{2,4}|(?!dsd-)[a-z]{3,6}-\d{3,4})(?![\dp])/i;
const ADULT_JAV_BARE = /^[a-z]{2}-\d{3,4}(-[a-z]|_hay)?\.(mp4|mkv|avi|wmv|mpe?g)$/i;
/* Site rips name themselves "site.YY.MM.DD.performer…" and OnlyFans dumps
   "name-YYYY-MM-DD-<post id>-…". */
const ADULT_SITE_DATED = /^[a-z]+\.\d{2}\.\d{2}\.\d{2}\.[a-z]|\d{4}-\d{2}-\d{2}-\d{9,}/i;
const ADULT_VIXEN_DATED = /vixen\.com|\bvixen\b[.\s-]*\d{2,4}[.\-]\d{2}[.\-]\d{2}/i;
const ADULT_XXX_EXCLUDE = /xander[.\s]?cage|xxx[.\s]*:?[.\s]*state[.\s]+of[.\s]+the[.\s]+union/i;
const SERIES_GUARD = /\bs\d{2}e\d{2}\b|\bseason\s?\d+\b|\bphần\s?\d+\b|\btập\s?\d+\b/i;
const KNOWN_TITLE_EXCLUDE = /money[.\s]shot|best[.\s]porn[.\s]star|pangalawang|loony[.\s]porn|after[.\s]porn[.\s]ends|angel[.\s]guts|porno[.\s]holocaust|roman[.\s]porno|the[.\s]lowlife|orgasm[.\s]inc|year[.\s]i[.\s]started[.\s]masturbating|young[.\s]people[.\s]fucking|don.?t[.\s]+fuck[.\s]+in[.\s]+the[.\s]+woods|end[.\s]of[.\s]the[.\s]f\S*ing[.\s]world|swallowed[.\s]star|swallowed[.\s]the[.\s]sun/i;

/**
 * A folder is a much bigger blast radius than a file: `move-to-x` cascades a
 * matched folder onto every row under it (see the comment above), so a bare
 * "XXX" false positive on a folder drags real content down with it — found
 * on a real folder, "- - Paris by night Clollection 001 - XXX Update", whose
 * "XXX" meant nothing but held nothing but legitimate Paris By Night discs.
 * `strict: true` (used for folders) drops that weakest signal and asks for a
 * studio/site name or an explicit act instead; a file keeps the full check.
 */
export function isAdultContent(name, { strict = false } = {}) {
  const text = markerText(name);
  if (KNOWN_TITLE_EXCLUDE.test(text) || SERIES_GUARD.test(text)) return false;
  if (ADULT_STUDIO_MARKERS.test(text)) return true;
  if (ADULT_EXPLICIT_MARKERS.test(text)) return true;
  if (ADULT_VIXEN_DATED.test(text)) return true;
  if (ADULT_JAV_CODE.test(text) || ADULT_JAV_BARE.test(text) || ADULT_SITE_DATED.test(text)) return true;
  if (strict) return false;
  // A release tag or a Vietnamese subtitle note beside a weak word is a
  // film: "Porno (2013) 1080p WEB-DL", "Pleasure 2021 Sub Việt (…ngôi sao Porn…)".
  if (MOVIE_MARKERS.test(text) || VIDEO_WORDS.test(text)) return false;
  return ADULT_WEAK_MARKERS.test(text) && !ADULT_XXX_EXCLUDE.test(text);
}

/** Search tokens: every word of the folded query. */
export function queryTokens(value) {
  return fold(value).replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Stable, deduplicated tokens stored with a row for fast client-side search. */
export function keywordTokens(values) {
  const value = Array.isArray(values) ? values.join(' ') : values;
  return [...new Set(queryTokens(value))];
}

/** Bring a sealed projection into the shape the view renders. */
export function normalizeMovieDatabase(value) {
  if (!value || value.version !== CATALOG_VERSION || !Array.isArray(value.links)) {
    throw new Error('Movie catalog is missing or has an unsupported version');
  }
  return {
    version: value.version,
    sealedAt: value.sealedAt || null,
    validated: value.validated === true,
    counts: value.counts || {},
    sources: Array.isArray(value.sources) ? value.sources : [],
    links: value.links
      .filter((row) => row && row.kind && row.code)
      .map((row) => ({
        ...row,
        id: row.id || linkId(row.kind, row.code),
        link: row.link || linkUrl(row.kind, row.code),
        status: STATUSES.includes(row.status) ? row.status : 'pending',
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        parents: Array.isArray(row.parents) ? row.parents : [],
        sourceIds: Array.isArray(row.sourceIds) ? row.sourceIds : [],
        titleKey: row.titleKey || titleKey(row.name),
        category: CATEGORIES.includes(row.category) ? row.category : 'movie'
      }))
  };
}

/** id → row, for walking parents. */
export function indexById(links) {
  return new Map((links || []).map((row) => [row.id, row]));
}

/**
 * The folder chain above a row, root first, as names. A file's place is its
 * `parents`; each parent is itself a row with parents, so the chain is walked
 * through the same map. Only the first parent is followed when a file was
 * seen in several folders — the others are counted, not drawn.
 */
export function folderChain(row, byId, limit = 8) {
  return ancestors(row, byId, limit).map((folder) => folder.name);
}

/** The folder rows above a row, root first. */
function ancestors(row, byId, limit = 8) {
  const chain = [];
  const seen = new Set([row.id]);
  let cursor = row;
  while (cursor && cursor.parents && cursor.parents.length && chain.length < limit) {
    const parent = byId.get(cursor.parents[0]);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.unshift(parent);
    cursor = parent;
  }
  return chain;
}

/* One collator, not `localeCompare(…, "vi")` per comparison: the locale
   string form re-resolves the collation on every call, which is what made
   sorting an unfiltered catalog cost a second. */
const COLLATOR = new Intl.Collator('vi');

/**
 * The folded text a movie row is searched by. The folder names above a file
 * are part of what it is called — a reader searching "dune" expects
 * Dune.2021.mkv inside "Dune (2021)" to match even when the file itself is
 * named for its release group.
 */
/* No keyword list: every token of the name/aliases/path is already a
   substring of the folded name/aliases/path, so a per-row token array was
   a second copy of the same text — 17% of the catalog and ~2s of the unlock. */
export function movieHaystack(row, byId = null, aboveCache = null) {
  return fold([row.name, ...(row.aliases || []), row.code, row.path || '', aboveText(row, byId, aboveCache)].join(' '));
}

/* The folder names and aliases above a row — a folder's aliases count too:
   the Vietnamese title a source gave a folder is how a reader looks for the
   English-named files inside it. Rows under one folder share this text, so
   the index computes it once per parent, not once per file: 88k files sit
   under 25k folders, and this walk was most of the index build. */
function aboveText(row, byId, cache) {
  if (!byId) return '';
  const parentId = row.parents && row.parents.length ? row.parents[0] : '';
  if (!parentId) return '';
  if (cache && cache.has(parentId)) return cache.get(parentId);
  const text = ancestors(row, byId).flatMap((folder) => [folder.name, ...(folder.aliases || [])]).join(' ');
  if (cache) cache.set(parentId, text);
  return text;
}

/**
 * Folded search text and sort key per row, computed once per unlock instead
 * of once per keystroke. `fold()` normalises and lowercases, and doing that
 * for 74k rows on every input event is what made typing stutter; with the
 * index a search is 74k `includes` calls, which is milliseconds. Keyed by row
 * identity so the rows themselves stay exactly what the envelope shipped.
 */
export function buildSearchIndex(links, haystack) {
  const hay = new Map();
  const nameKey = new Map();
  const above = new Map();
  for (const row of links || []) {
    hay.set(row, haystack(row, above));
    nameKey.set(row, fold(row.name));
  }
  return { hay, nameKey };
}

/**
 * True when every row matching `next` also matched `prev`, so a view may
 * search the previous result set instead of the whole catalog. Each token is
 * a substring test, so the guarantee holds when every previous token is
 * contained in some next token — typing "dun" → "dune", or adding a word.
 * Deleting a character breaks it and the caller falls back to the full scan.
 */
export function narrowsSearch(prev, next) {
  const before = queryTokens(prev);
  if (!before.length) return true;
  const after = queryTokens(next);
  return before.every((token) => after.some((candidate) => candidate.includes(token)));
}

const sizeOf = (row) => Number.isFinite(Number(row?.size)) ? Number(row.size) : 0;

/* Numeric-aware: "Tập 2" before "Tập 10". A folder is read as its owner
   listed it — episodes, parts, discs — and that listing is in name order. */
const NAME_ORDER = new Intl.Collator('vi', { numeric: true });

/**
 * Name order, then size, then code — the order inside one folder. It was
 * size first, which shuffled a 29-episode folder into a random-looking
 * list; the sizes of one film's versions still sit together because those
 * rows share a name stem, and size only breaks the tie between equal names.
 */
export function sortMovieRows(rows, nameOf = (row) => fold(row.name)) {
  return (rows || [])
    .map((row) => [nameOf(row), sizeOf(row), String(row.code || ''), row])
    .sort((a, b) => NAME_ORDER.compare(a[0], b[0]) || a[1] - b[1] || a[2].localeCompare(b[2]))
    .map((pair) => pair[3]);
}

/**
 * The rows a query matches, in catalog order and nothing else: a one-letter
 * query matches 60k of 88k files, and sorting those to show 150 was what
 * made the first keystroke stall. Every token must be a substring of the
 * row's folded haystack (name, aliases, code, path, the folders above it).
 */
export function matchMovieLinks(links, query, { kind = 'all', status = 'all', sourceId = 'all', category = 'all', byId = null, index = null } = {}) {
  const tokens = queryTokens(query);
  const hayOf = (row) => (index && index.hay.get(row)) ?? movieHaystack(row, byId);
  return (links || []).filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (category !== 'all' && (row.category || 'movie') !== category) return false;
    if (sourceId !== 'all' && !(row.sourceIds || []).includes(sourceId)) return false;
    if (!tokens.length) return true;
    const haystack = hayOf(row);
    return tokens.every((token) => haystack.includes(token));
  });
}

export function searchMovieLinks(links, query, options = {}) {
  const nameOf = (row) => (options.index && options.index.nameKey.get(row)) ?? fold(row.name);
  return sortMovieRows(matchMovieLinks(links, query, options), nameOf);
}

/**
 * Matches grouped under their holding folder, groups ordered by how well the
 * folder answers the query: a folder whose own name or alias carries every
 * token first (the film was filed under that name), then folders where some
 * token is in the folder, then folders reached only through a file's own
 * name or a grandparent; ties by name, and with no query plain name order —
 * the browse view. Only the ORDER OF GROUPS is decided here: a group's rows
 * are sorted by the caller for the groups it renders (sortMovieRows),
 * so a query matching 8k folders costs one pass and one 8k-element sort.
 */
export function rankFolderGroups(matches, query, byId, index = null) {
  const tokens = queryTokens(query);
  const nameOf = (row) => (index && index.nameKey.get(row)) ?? fold(row.name);
  const groups = new Map();
  for (const row of matches || []) {
    const parentId = row.parents && row.parents.length ? row.parents[0] : '';
    let group = groups.get(parentId);
    if (!group) {
      const folder = parentId && byId ? byId.get(parentId) || null : null;
      group = { key: parentId || '(standalone)', folder, links: [], score: 0, nameKey: folder ? nameOf(folder) : '' };
      groups.set(parentId, group);
    }
    group.links.push(row);
  }
  if (tokens.length) {
    for (const group of groups.values()) {
      const folderText = group.folder ? fold([group.folder.name, ...(group.folder.aliases || [])].join(' ')) : '';
      const inFolder = tokens.filter((token) => folderText.includes(token)).length;
      const byOwnName = group.links.some((row) => { const name = nameOf(row); return tokens.every((token) => name.includes(token)); });
      group.score = (inFolder === tokens.length ? 4 : inFolder ? 2 : 0) + (byOwnName ? 1 : 0);
    }
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || COLLATOR.compare(a.nameKey, b.nameKey) || a.key.localeCompare(b.key));
}

/**
 * fold() for highlighting: the same folding, one output unit per input unit,
 * so an offset found in the folded text is the offset in the original.
 * fold() itself may not be used for this — NFKD turns "ế" into three units.
 */
export function foldAligned(text) {
  let out = '';
  for (const ch of String(text || '')) {
    let folded = ch === 'đ' || ch === 'Đ' ? 'd' : (ch.normalize('NFKD')[0] || ch).toLowerCase();
    if (folded.length !== ch.length) folded = ch;
    out += folded;
  }
  return out;
}

/** [start, end) ranges of every token in `text`, merged, for <mark>. */
export function matchRanges(text, tokens) {
  const folded = foldAligned(text);
  const ranges = [];
  for (const token of tokens || []) {
    if (!token) continue;
    let from = 0;
    while (from < folded.length) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      ranges.push([at, at + token.length]);
      from = at + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range.slice());
  }
  return merged;
}

/** Files grouped by folder, with the smallest result first within each group. */
export function groupByFolder(links, byId, index = null) {
  const groups = new Map();
  const nameOf = (row) => (index && index.nameKey.get(row)) ?? fold(row.name);
  (links || []).forEach((row) => {
    const parentId = row.parents && row.parents.length ? row.parents[0] : '';
    const key = parentId || '(standalone)';
    let group = groups.get(key);
    if (!group) {
      // Every row in a group shares the parent, so the chain is walked once
      // per folder rather than once per file.
      const chain = folderChain(row, byId);
      group = { key, folder: parentId ? byId.get(parentId) || null : null, chain, links: [], sortKey: fold(chain.join(' / ')) };
      groups.set(key, group);
    }
    group.links.push(row);
  });
  // Sort keys are folded once per row, never inside the comparator.
  return [...groups.values()]
    .sort((a, b) => COLLATOR.compare(a.sortKey, b.sortKey))
    .map(({ sortKey, ...group }) => ({
      ...group,
      links: sortMovieRows(group.links, nameOf)
    }));
}

/** Rows that share a titleKey become one group, so two copies of one film sit together. */
export function groupByTitle(links) {
  const groups = new Map();
  (links || []).forEach((row) => {
    const key = row.titleKey || titleKey(row.name);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: row.name, links: [] };
      groups.set(key, group);
    }
    group.links.push(row);
  });
  const byKind = { folder: 0, file: 1 };
  return [...groups.values()]
    .sort((a, b) => a.key.localeCompare(b.key, 'vi') || a.name.localeCompare(b.name, 'vi'))
    .map((group) => ({
      ...group,
      links: group.links.slice().sort((a, b) => (byKind[a.kind] - byKind[b.kind]) || a.code.localeCompare(b.code))
    }));
}

export function sourceName(sourceMap, sourceId) {
  return sourceMap.get(sourceId)?.name || sourceId;
}
