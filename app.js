/* =====================================================================
   보드게임 대여공간 - app.js
   전자칠판(터치스크린) 초등학생용 보드게임 대여/반납 프로그램
   ===================================================================== */

/* ------------------------- 기본 데이터 ------------------------- */

const STORAGE_KEY_GAMES = 'bgrental_games_v1';
const STORAGE_KEY_RENTALS = 'bgrental_rentals_v1';
const STORAGE_KEY_RECESS = 'bgrental_recess_v1';
const STORAGE_KEY_HISTORY = 'bgrental_history_v1';
const STORAGE_KEY_CONFIG = 'bgrental_config_v1';
const STORAGE_KEY_PENALTIES = 'bgrental_penalties_v1';
const MAX_HISTORY_ENTRIES = 300;

const DEFAULT_RECESS_END_TIME = '12:30';
const DEFAULT_RECESS_ALERT_TIME = '12:25';
const DEFAULT_RECESS_MESSAGE = '4교시 수업 준비하세요';

const DEFAULT_OVERDUE_PENALTY_MINUTES = 10;
const DEFAULT_GROUP_COUNT = 6;
const DEFAULT_STUDENT_COUNT = 25;

const COVER_CLASSES = ['cv-0', 'cv-1', 'cv-2', 'cv-3', 'cv-4', 'cv-5', 'cv-6', 'cv-7'];

const DEFAULT_GAMES = [
  { id: 'g_halligalli', name: '할리갈리',   minutes: 10, maxMinutes: 30, cover: COVER_CLASSES[0], builtin: true },
  { id: 'g_rummikub',   name: '루미큐브',   minutes: 20, maxMinutes: 30, cover: COVER_CLASSES[1], builtin: true },
  { id: 'g_jenga',      name: '젠가',       minutes: 15, maxMinutes: 30, cover: COVER_CLASSES[2], builtin: true },
  { id: 'g_bluemarble', name: '부루마블',   minutes: 30, maxMinutes: 30, cover: COVER_CLASSES[3], builtin: true },
  { id: 'g_dobble',     name: '도블',       minutes: 10, maxMinutes: 30, cover: COVER_CLASSES[4], builtin: true },
  { id: 'g_uno',        name: '우노',       minutes: 15, maxMinutes: 30, cover: COVER_CLASSES[5], builtin: true },
  { id: 'g_davinci',    name: '다빈치코드', minutes: 15, maxMinutes: 30, cover: COVER_CLASSES[6], builtin: true },
];

const MAX_RENT_NUMBERS = 5;

function getGroupNames() {
  return Array.from({ length: config.groupCount }, (_, i) => `${i + 1}모둠`);
}

function getNumberOptions() {
  return Array.from({ length: config.studentCount }, (_, i) => i + 1);
}

const MIN_MINUTES = 5;
const MAX_MINUTES = 30; // 게임별 maxMinutes가 없을 때의 기본값
const STEP_MINUTES = 5;
const SLIDER_MAX_CAP = 30; // 관리자가 설정 가능한 최대 대여 시간 슬라이더 상한

function getGameMaxMinutes(game) {
  return (game && game.maxMinutes) || MAX_MINUTES;
}

const ADMIN_PIN = '2026';

/* ------------------------- 아이콘 ------------------------- */

const ICON_PATHS = {
  clock: '<circle cx="12" cy="12" r="8.5"/><polyline points="12 7.5 12 12 15.5 14"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 13.6c2.4.3 4 2.2 4 5.4"/>',
  undo: '<path d="M7 7L4 10l3 3"/><path d="M4 10h11a4.5 4.5 0 0 1 0 9H10"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};

function icon(name, size) {
  size = size || 16;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

/* ------------------------- 상태 ------------------------- */

let games = loadGames();
let rentals = loadRentals();
let recess = loadRecess();
let history = loadHistory();
let config = loadConfig();
let penalties = loadPenalties();
let currentFilter = 'all';
let searchQuery = '';

let pendingRentGameId = null;
let pendingRentMinutes = 15;
let pendingRentMaxMinutes = MAX_MINUTES;
let pendingRentGroup = null;
let pendingRentNumbers = [];

let newGameDraft = null; // { name, cover, minutes, image }

let keyboardTarget = null; // 'gameName' | 'search' | 'recessMessage'
let composer = null;
let kbMode = 'ko';

/* ------------------------- 저장/불러오기 ------------------------- */

function loadGames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAMES);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_GAMES.slice();
}

function saveGames() {
  try { localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(games)); } catch (e) {}
}

function loadRentals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RENTALS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

function saveRentals() {
  try { localStorage.setItem(STORAGE_KEY_RENTALS, JSON.stringify(rentals)); } catch (e) {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveHistory() {
  try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history)); } catch (e) {}
}

function loadRecess() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECESS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { endTime: DEFAULT_RECESS_END_TIME, alertTime: DEFAULT_RECESS_ALERT_TIME, message: DEFAULT_RECESS_MESSAGE };
}

function saveRecess() {
  try { localStorage.setItem(STORAGE_KEY_RECESS, JSON.stringify(recess)); } catch (e) {}
}

function loadConfig() {
  const defaults = {
    overduePenaltyMinutes: DEFAULT_OVERDUE_PENALTY_MINUTES,
    groupCount: DEFAULT_GROUP_COUNT,
    studentCount: DEFAULT_STUDENT_COUNT,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return Object.assign(defaults, JSON.parse(raw));
  } catch (e) {}
  return defaults;
}

function saveConfig() {
  try { localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config)); } catch (e) {}
}

function loadPenalties() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENALTIES);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { groups: {}, numbers: {} };
}

function savePenalties() {
  try { localStorage.setItem(STORAGE_KEY_PENALTIES, JSON.stringify(penalties)); } catch (e) {}
}

function todayAt(hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/* ------------------------- 한글 조합기 ------------------------- */

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const JONG_SINGLE = { 'ㄱ':1,'ㄲ':2,'ㄴ':4,'ㄷ':7,'ㄹ':8,'ㅁ':16,'ㅂ':17,'ㅅ':19,'ㅆ':20,'ㅇ':21,'ㅈ':22,'ㅊ':23,'ㅋ':24,'ㅌ':25,'ㅍ':26,'ㅎ':27 };

const JONG_COMBOS = {
  1: { 'ㅅ': 3 },
  4: { 'ㅈ': 5, 'ㅎ': 6 },
  8: { 'ㄱ': 9, 'ㅁ': 10, 'ㅂ': 11, 'ㅅ': 12, 'ㅌ': 13, 'ㅍ': 14, 'ㅎ': 15 },
  17: { 'ㅅ': 18 },
};

const JONG_SPLIT = {};
for (let i = 1; i < JONG.length; i++) JONG_SPLIT[i] = { keep: null, newCho: JONG[i] };
JONG_SPLIT[3]  = { keep: 1,  newCho: 'ㅅ' };
JONG_SPLIT[5]  = { keep: 4,  newCho: 'ㅈ' };
JONG_SPLIT[6]  = { keep: 4,  newCho: 'ㅎ' };
JONG_SPLIT[9]  = { keep: 8,  newCho: 'ㄱ' };
JONG_SPLIT[10] = { keep: 8,  newCho: 'ㅁ' };
JONG_SPLIT[11] = { keep: 8,  newCho: 'ㅂ' };
JONG_SPLIT[12] = { keep: 8,  newCho: 'ㅅ' };
JONG_SPLIT[13] = { keep: 8,  newCho: 'ㅌ' };
JONG_SPLIT[14] = { keep: 8,  newCho: 'ㅍ' };
JONG_SPLIT[15] = { keep: 8,  newCho: 'ㅎ' };
JONG_SPLIT[18] = { keep: 17, newCho: 'ㅅ' };

class HangulComposer {
  constructor(initialText = '') {
    this.committed = initialText;
    this.cho = null;
    this.jung = null;
    this.jong = null;
  }
  isCho(ch) { return CHO.includes(ch); }
  isJung(ch) { return JUNG.includes(ch); }

  currentComposeChar() {
    if (this.cho != null && this.jung != null) {
      const jongIdx = this.jong != null ? this.jong : 0;
      const code = 0xAC00 + this.cho * 588 + this.jung * 28 + jongIdx;
      return String.fromCharCode(code);
    } else if (this.cho != null) {
      return CHO[this.cho];
    } else if (this.jung != null) {
      return JUNG[this.jung];
    }
    return '';
  }

  commit() {
    const c = this.currentComposeChar();
    if (c) this.committed += c;
    this.cho = this.jung = this.jong = null;
  }

  typeChar(ch) {
    if (this.isCho(ch)) this.typeConsonant(ch);
    else if (this.isJung(ch)) this.typeVowel(ch);
    else { this.commit(); this.committed += ch; }
    return this.getText();
  }

  typeConsonant(ch) {
    const choIdx = CHO.indexOf(ch);
    if (this.cho == null) {
      this.cho = choIdx;
    } else if (this.jung == null) {
      this.commit();
      this.cho = choIdx;
    } else if (this.jong == null) {
      if (Object.prototype.hasOwnProperty.call(JONG_SINGLE, ch)) {
        this.jong = JONG_SINGLE[ch];
      } else {
        this.commit();
        this.cho = choIdx;
      }
    } else {
      const combo = JONG_COMBOS[this.jong] && JONG_COMBOS[this.jong][ch];
      if (combo) {
        this.jong = combo;
      } else {
        this.commit();
        this.cho = choIdx;
      }
    }
  }

  typeVowel(ch) {
    const jungIdx = JUNG.indexOf(ch);
    if (this.cho == null && this.jung == null) {
      this.jung = jungIdx;
    } else if (this.cho != null && this.jung == null) {
      this.jung = jungIdx;
    } else if (this.jong == null) {
      this.commit();
      this.jung = jungIdx;
    } else {
      const split = JONG_SPLIT[this.jong];
      this.jong = split.keep;
      const movedCho = split.newCho;
      this.commit();
      this.cho = CHO.indexOf(movedCho);
      this.jung = jungIdx;
    }
  }

  backspace() {
    if (this.jong != null) this.jong = null;
    else if (this.jung != null) this.jung = null;
    else if (this.cho != null) this.cho = null;
    else if (this.committed.length > 0) this.committed = this.committed.slice(0, -1);
  }

  space() {
    this.commit();
    this.committed += ' ';
  }

  clear() {
    this.committed = '';
    this.cho = this.jung = this.jong = null;
  }

  getText() {
    return this.committed + this.currentComposeChar();
  }
}

/* ------------------------- 오디오 (알림음) ------------------------- */

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('touchstart', ensureAudio, { once: true });
document.addEventListener('click', ensureAudio, { once: true });

function beep(freq = 880, duration = 160, delay = 0, type = 'sine') {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration / 1000);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration / 1000 + 0.02);
}

function playWarnBeep() { beep(740, 150, 0, 'sine'); }
function playOverdueBeep() {
  beep(880, 140, 0, 'square');
  beep(880, 140, 0.22, 'square');
  beep(880, 220, 0.44, 'square');
}
function playReturnChime() {
  beep(660, 120, 0, 'sine');
  beep(880, 160, 0.12, 'sine');
}
function playStartChime() {
  beep(520, 100, 0, 'sine');
  beep(780, 160, 0.1, 'sine');
}

/* ------------------------- 유틸 ------------------------- */

function formatClock(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatRemainingLong(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  return `${m}분 ${s}초`;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

function findGame(id) { return games.find(g => g.id === id); }

/* ------------------------- 대여 제한 (1인/1모둠 1게임) ------------------------- */

function getActiveRenterSets(excludeGameId) {
  const groups = new Set();
  const numbers = new Set();
  Object.keys(rentals).forEach(gameId => {
    if (gameId === excludeGameId) return;
    const r = rentals[gameId];
    if (!r || r.status !== 'rented') return;
    if (r.renterGroup) groups.add(r.renterGroup);
    (r.renterNumbers || []).forEach(n => numbers.add(n));
  });
  return { groups, numbers };
}

/* ------------------------- 연체 재대여 제한 (페널티) ------------------------- */

function cleanupExpiredPenalties() {
  const now = Date.now();
  let changed = false;
  Object.keys(penalties.groups).forEach(name => {
    if (penalties.groups[name] <= now) { delete penalties.groups[name]; changed = true; }
  });
  Object.keys(penalties.numbers).forEach(num => {
    if (penalties.numbers[num] <= now) { delete penalties.numbers[num]; changed = true; }
  });
  if (changed) savePenalties();
}

function getGroupPenaltyRemainingMs(name) {
  const until = penalties.groups[name];
  return until ? Math.max(0, until - Date.now()) : 0;
}

function getNumberPenaltyRemainingMs(num) {
  const until = penalties.numbers[num];
  return until ? Math.max(0, until - Date.now()) : 0;
}

function applyOverduePenalty(rental) {
  const minutes = config.overduePenaltyMinutes || 0;
  if (minutes <= 0) return;
  const until = Date.now() + minutes * 60 * 1000;
  if (rental.renterGroup) penalties.groups[rental.renterGroup] = until;
  (rental.renterNumbers || []).forEach(n => { penalties.numbers[n] = until; });
  savePenalties();
}

/* ------------------------- 렌더링 ------------------------- */

function renderGrid() {
  const grid = document.getElementById('gameGrid');
  const emptyMsg = document.getElementById('emptyMsg');
  grid.innerHTML = '';

  const q = searchQuery.trim().toLowerCase();
  const visible = games.filter(g => {
    if (q && !g.name.toLowerCase().includes(q)) return false;
    const r = rentals[g.id];
    const status = (r && r.status === 'rented') ? 'rented' : 'available';
    if (currentFilter !== 'all' && currentFilter !== status) return false;
    return true;
  });

  emptyMsg.hidden = visible.length > 0;

  visible.forEach(g => grid.appendChild(buildCard(g)));
  tickTimers();
}

function buildCard(game) {
  const rental = rentals[game.id];
  const isRented = rental && rental.status === 'rented';

  const card = document.createElement('div');
  card.className = 'card' + (isRented ? ' rented' : '');
  card.dataset.gameId = game.id;

  const cover = document.createElement('div');
  cover.className = `card-cover ${game.cover || COVER_CLASSES[0]}`;
  if (game.image) {
    const img = document.createElement('img');
    img.src = game.image;
    cover.appendChild(img);
  } else {
    const mono = document.createElement('span');
    mono.className = 'card-monogram';
    mono.textContent = game.name || '?';
    cover.appendChild(mono);
  }
  card.appendChild(cover);

  const edit = document.createElement('button');
  edit.className = 'card-edit';
  edit.innerHTML = icon('edit', 15);
  edit.addEventListener('click', (e) => {
    e.stopPropagation();
    requireAdminPin(() => openGameFormModal(game));
  });
  cover.appendChild(edit);

  const del = document.createElement('button');
  del.className = 'card-delete';
  del.innerHTML = icon('trash', 15);
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isRented) { showToast('대여 중인 게임은 삭제할 수 없어요'); return; }
    requireAdminPin(() => deleteGame(game.id));
  });
  cover.appendChild(del);

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = game.name;
  body.appendChild(title);

  if (!isRented) {
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `기본 ${game.minutes}분 이용`;
    body.appendChild(meta);

    const badge = document.createElement('div');
    badge.className = 'badge badge-available';
    badge.innerHTML = '<span class="badge-dot"></span>대여 가능';
    body.appendChild(badge);

    const rentBtn = document.createElement('button');
    rentBtn.className = 'rent-btn';
    rentBtn.textContent = '대여하기';
    rentBtn.addEventListener('click', () => openRentModal(game.id));
    body.appendChild(rentBtn);
  } else {
    const badgeRow = document.createElement('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.gap = '6px';
    const badge = document.createElement('div');
    badge.className = 'badge badge-rented';
    badge.innerHTML = '<span class="badge-dot"></span>대여중';
    badgeRow.appendChild(badge);
    body.appendChild(badgeRow);

    const renterRow = document.createElement('div');
    renterRow.className = 'renter-row';
    renterRow.innerHTML = `${icon('users', 15)}<span>${escapeHtml(rental.renter || '이름없음')}</span>`;
    body.appendChild(renterRow);

    const timerDisplay = document.createElement('div');
    timerDisplay.className = 'timer-display';
    timerDisplay.dataset.role = 'timer';
    timerDisplay.textContent = '--:--';
    body.appendChild(timerDisplay);

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.dataset.role = 'progress';
    fill.style.width = '100%';
    track.appendChild(fill);
    body.appendChild(track);

    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';

    const returnBtn = document.createElement('button');
    returnBtn.className = 'action-btn return-btn';
    returnBtn.innerHTML = `${icon('undo', 15)}반납하기`;
    returnBtn.addEventListener('click', () => openReturnConfirmModal(game.id));
    actionRow.appendChild(returnBtn);

    body.appendChild(actionRow);
  }

  card.appendChild(body);
  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ------------------------- 타이머 틱 ------------------------- */

function tickTimers() {
  const now = Date.now();
  document.querySelectorAll('.card').forEach(card => {
    const gameId = card.dataset.gameId;
    const rental = rentals[gameId];
    if (!rental || rental.status !== 'rented') return;

    const remaining = rental.endAt - now;
    const total = rental.totalMs || (rental.endAt - rental.startAt);
    const frac = Math.max(0, Math.min(1, remaining / total));

    const timerEl = card.querySelector('[data-role="timer"]');
    const fillEl = card.querySelector('[data-role="progress"]');

    card.classList.remove('warn', 'danger', 'overdue');

    if (remaining <= 0) {
      const overdueMinutes = Math.floor(-remaining / 60000);
      if (timerEl) timerEl.textContent = overdueMinutes > 0 ? `${overdueMinutes}분 초과!` : '시간 종료!';
      if (fillEl) fillEl.style.width = '0%';
      card.classList.add('overdue', 'danger');

      if (!rental._overdueNotified) {
        rental._overdueNotified = true;
        playOverdueBeep();
        saveRentals();
      } else if (!rental._lastOverdueBeepAt || now - rental._lastOverdueBeepAt > 60000) {
        rental._lastOverdueBeepAt = now;
        playOverdueBeep();
      }
    } else {
      if (timerEl) timerEl.textContent = formatClock(remaining);
      if (fillEl) fillEl.style.width = `${frac * 100}%`;

      if (frac <= 0.15) {
        card.classList.add('danger');
      } else if (frac <= 0.35) {
        card.classList.add('warn');
      }

      if (frac <= 0.15 && !rental._dangerNotified) {
        rental._dangerNotified = true;
        playWarnBeep();
      }
    }
  });
}

function tickRecess() {
  const now = new Date();
  const endAt = todayAt(recess.endTime);
  const alertAt = todayAt(recess.alertTime);
  const remaining = endAt - now;
  const isAlert = now >= alertAt && now <= endAt;

  const countdownEl = document.getElementById('recessCountdown');
  const alertEl = document.getElementById('recessAlert');
  const alertTextEl = document.getElementById('recessAlertText');

  countdownEl.textContent = formatRemainingLong(remaining);
  countdownEl.classList.toggle('danger', isAlert);
  alertTextEl.textContent = recess.message || DEFAULT_RECESS_MESSAGE;
  alertEl.hidden = !isAlert;

  if (isAlert && !recess._warned) {
    recess._warned = true;
    playWarnBeep();
  }
  if (now >= endAt && !recess._ended) {
    recess._ended = true;
    playOverdueBeep();
  }
  if (now < alertAt) {
    recess._warned = false;
    recess._ended = false;
  }
}

function tick() {
  const now = new Date();
  const h = now.getHours();
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  document.getElementById('recessClock').textContent = `${period} ${h12}시 ${now.getMinutes()}분`;
  tickRecess();
  tickTimers();
}

setInterval(tick, 1000);
tick();

/* ------------------------- 대여 / 연장 / 반납 ------------------------- */

function openRentModal(gameId) {
  const game = findGame(gameId);
  if (!game) return;
  pendingRentGameId = gameId;
  pendingRentMaxMinutes = getGameMaxMinutes(game);
  pendingRentMinutes = Math.min(game.minutes, pendingRentMaxMinutes);
  pendingRentGroup = null;
  pendingRentNumbers = [];

  const preview = document.getElementById('rentGamePreview');
  preview.innerHTML = '';
  const mini = document.createElement('div');
  mini.className = `cover-mini ${game.cover || COVER_CLASSES[0]}`;
  if (game.image) {
    const img = document.createElement('img'); img.src = game.image; mini.appendChild(img);
  } else {
    mini.textContent = (game.name || '?').trim().charAt(0);
  }
  preview.appendChild(mini);
  const label = document.createElement('div');
  label.textContent = game.name;
  preview.appendChild(label);

  document.getElementById('rentMinutesVal').textContent = `${pendingRentMinutes}분`;

  cleanupExpiredPenalties();
  const activeSets = getActiveRenterSets(gameId);

  const groupRow = document.getElementById('groupRow');
  groupRow.innerHTML = '';
  getGroupNames().forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.textContent = name;
    const rentedElsewhere = activeSets.groups.has(name);
    const penaltyMs = getGroupPenaltyRemainingMs(name);
    const blocked = rentedElsewhere || penaltyMs > 0;
    if (blocked) chip.classList.add('chip-blocked');
    chip.addEventListener('click', () => {
      if (blocked) {
        showToast(rentedElsewhere
          ? `${name}은(는) 이미 다른 게임을 대여 중이에요`
          : `${name}은(는) 연체 페널티로 ${Math.ceil(penaltyMs / 60000)}분 후에 대여할 수 있어요`);
        return;
      }
      if (pendingRentGroup === name) {
        pendingRentGroup = null;
        chip.classList.remove('selected');
        return;
      }
      pendingRentGroup = name;
      groupRow.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
    groupRow.appendChild(chip);
  });

  const numberRowLabel = document.getElementById('numberRowLabel');
  if (numberRowLabel) numberRowLabel.textContent = `번호 선택 (1~${config.studentCount}번 중 최대 ${MAX_RENT_NUMBERS}명)`;

  const numberRow = document.getElementById('numberRow');
  numberRow.innerHTML = '';
  getNumberOptions().forEach(num => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.textContent = `${num}번`;
    const rentedElsewhere = activeSets.numbers.has(num);
    const penaltyMs = getNumberPenaltyRemainingMs(num);
    const blocked = rentedElsewhere || penaltyMs > 0;
    if (blocked) chip.classList.add('chip-blocked');
    chip.addEventListener('click', () => {
      if (blocked) {
        showToast(rentedElsewhere
          ? `${num}번은 이미 다른 게임을 대여 중이에요`
          : `${num}번은 연체 페널티로 ${Math.ceil(penaltyMs / 60000)}분 후에 대여할 수 있어요`);
        return;
      }
      const idx = pendingRentNumbers.indexOf(num);
      if (idx === -1) {
        if (pendingRentNumbers.length >= MAX_RENT_NUMBERS) {
          showToast(`번호는 최대 ${MAX_RENT_NUMBERS}명까지 선택할 수 있어요`);
          return;
        }
        pendingRentNumbers.push(num);
        chip.classList.add('selected');
      } else {
        pendingRentNumbers.splice(idx, 1);
        chip.classList.remove('selected');
      }
    });
    numberRow.appendChild(chip);
  });

  document.getElementById('rentModal').hidden = false;
}

document.getElementById('minusMinBtn').addEventListener('click', () => {
  pendingRentMinutes = Math.max(MIN_MINUTES, pendingRentMinutes - STEP_MINUTES);
  document.getElementById('rentMinutesVal').textContent = `${pendingRentMinutes}분`;
});
document.getElementById('plusMinBtn').addEventListener('click', () => {
  if (pendingRentMinutes >= pendingRentMaxMinutes) {
    showToast(`이 게임은 최대 ${pendingRentMaxMinutes}분까지 대여할 수 있어요`);
    return;
  }
  pendingRentMinutes = Math.min(pendingRentMaxMinutes, pendingRentMinutes + STEP_MINUTES);
  document.getElementById('rentMinutesVal').textContent = `${pendingRentMinutes}분`;
});

document.getElementById('confirmRentBtn').addEventListener('click', () => {
  if (!pendingRentGameId) return;
  if (!pendingRentGroup && pendingRentNumbers.length === 0) {
    showToast('모둠 또는 번호를 선택해주세요!');
    return;
  }

  cleanupExpiredPenalties();
  const activeSets = getActiveRenterSets(pendingRentGameId);
  if (pendingRentGroup && (activeSets.groups.has(pendingRentGroup) || getGroupPenaltyRemainingMs(pendingRentGroup) > 0)) {
    showToast(`${pendingRentGroup}은(는) 지금 대여할 수 없어요`);
    return;
  }
  const blockedNumber = pendingRentNumbers.find(n => activeSets.numbers.has(n) || getNumberPenaltyRemainingMs(n) > 0);
  if (blockedNumber != null) {
    showToast(`${blockedNumber}번은 지금 대여할 수 없어요`);
    return;
  }

  const sortedNumbers = pendingRentNumbers.slice().sort((a, b) => a - b);
  const renter = pendingRentGroup && sortedNumbers.length > 0
    ? `${pendingRentGroup} ${sortedNumbers.join(', ')}번`
    : pendingRentGroup
      ? pendingRentGroup
      : `${sortedNumbers.join(', ')}번`;
  const now = Date.now();
  const totalMs = pendingRentMinutes * 60 * 1000;
  rentals[pendingRentGameId] = {
    status: 'rented',
    renter,
    renterGroup: pendingRentGroup,
    renterNumbers: sortedNumbers,
    startAt: now,
    endAt: now + totalMs,
    totalMs: totalMs,
  };
  saveRentals();
  closeAllModals();
  renderGrid();
  playStartChime();
  showToast('대여를 시작했어요! 재미있게 즐겨요');
});

let pendingReturnGameId = null;

function openReturnConfirmModal(gameId) {
  pendingReturnGameId = gameId;
  document.getElementById('returnConfirmModal').hidden = false;
}

document.getElementById('confirmReturnBtn').addEventListener('click', () => {
  if (!pendingReturnGameId) return;
  const gameId = pendingReturnGameId;
  pendingReturnGameId = null;
  closeAllModals();
  returnRental(gameId);
});

function returnRental(gameId) {
  const rental = rentals[gameId];
  if (!rental) return;
  const now = Date.now();
  const wasOverdue = now > rental.endAt;
  const game = games.find(g => g.id === gameId);
  history.push({
    gameId,
    gameName: game ? game.name : '알 수 없음',
    renter: rental.renter || '',
    startAt: rental.startAt,
    returnedAt: now,
    overdue: wasOverdue,
  });
  if (history.length > MAX_HISTORY_ENTRIES) {
    history = history.slice(history.length - MAX_HISTORY_ENTRIES);
  }
  saveHistory();

  if (wasOverdue) applyOverduePenalty(rental);

  delete rentals[gameId];
  saveRentals();
  renderGrid();
  playReturnChime();

  if (wasOverdue && config.overduePenaltyMinutes > 0) {
    showToast(`반납 완료! 연체로 인해 ${config.overduePenaltyMinutes}분 동안 재대여가 제한돼요`);
  } else {
    showToast('반납 완료! 다음 친구가 빌릴 수 있어요');
  }
}

/* ------------------------- 게임 추가 / 수정 ------------------------- */

function openGameFormModal(existingGame) {
  const isEdit = !!existingGame;
  newGameDraft = isEdit
    ? {
        id: existingGame.id,
        name: existingGame.name,
        cover: existingGame.cover || COVER_CLASSES[0],
        minutes: existingGame.minutes,
        maxMinutes: getGameMaxMinutes(existingGame),
        image: existingGame.image || null,
      }
    : { name: '', cover: COVER_CLASSES[0], minutes: 15, maxMinutes: MAX_MINUTES, image: null };

  document.getElementById('addGameModalTitle').textContent = isEdit ? '게임 설정 수정' : '새 보드게임 추가';
  document.getElementById('confirmAddGameBtnText').textContent = isEdit ? '저장하기' : '추가하기';

  const newGameNameInput = document.getElementById('newGameNameInput');
  newGameNameInput.value = newGameDraft.name;
  newGameNameInput.parentElement.classList.toggle('filled', !!newGameDraft.name);

  const uploadPreview = document.getElementById('uploadPreview');
  if (newGameDraft.image) {
    uploadPreview.innerHTML = `<img src="${newGameDraft.image}">`;
    uploadPreview.hidden = false;
  } else {
    uploadPreview.innerHTML = '';
    uploadPreview.hidden = true;
  }
  document.getElementById('imageUploadInput').value = '';

  const colorGrid = document.getElementById('colorGrid');
  colorGrid.innerHTML = '';
  COVER_CLASSES.forEach(cls => {
    const opt = document.createElement('button');
    opt.className = 'color-opt ' + cls + (cls === newGameDraft.cover ? ' selected' : '');
    opt.addEventListener('click', () => {
      newGameDraft.cover = cls;
      colorGrid.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
    colorGrid.appendChild(opt);
  });

  const maxSlider = document.getElementById('newGameMaxMinutesSlider');
  const minSlider = document.getElementById('newGameMinutesSlider');
  maxSlider.value = newGameDraft.maxMinutes;
  document.getElementById('newGameMaxMinutesVal').textContent = `${newGameDraft.maxMinutes}분`;
  minSlider.max = newGameDraft.maxMinutes;
  newGameDraft.minutes = Math.min(newGameDraft.minutes, newGameDraft.maxMinutes);
  minSlider.value = newGameDraft.minutes;
  document.getElementById('newGameMinutesVal').textContent = `${newGameDraft.minutes}분`;

  document.getElementById('addGameModal').hidden = false;
}

document.getElementById('openAddGameBtn').addEventListener('click', () => {
  requireAdminPin(() => openGameFormModal(null));
});

document.getElementById('newGameNameInput').addEventListener('input', (e) => {
  newGameDraft.name = e.target.value;
  e.target.parentElement.classList.toggle('filled', !!e.target.value);
});

document.getElementById('imageUploadInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    newGameDraft.image = reader.result;
    const preview = document.getElementById('uploadPreview');
    preview.innerHTML = `<img src="${reader.result}">`;
    preview.hidden = false;
  };
  reader.readAsDataURL(file);
});

document.getElementById('newGameMaxMinutesSlider').addEventListener('input', (e) => {
  const maxVal = Number(e.target.value);
  newGameDraft.maxMinutes = maxVal;
  document.getElementById('newGameMaxMinutesVal').textContent = `${maxVal}분`;

  const minSlider = document.getElementById('newGameMinutesSlider');
  minSlider.max = maxVal;
  if (newGameDraft.minutes > maxVal) {
    newGameDraft.minutes = maxVal;
    minSlider.value = maxVal;
    document.getElementById('newGameMinutesVal').textContent = `${maxVal}분`;
  }
});

document.getElementById('newGameMinutesSlider').addEventListener('input', (e) => {
  newGameDraft.minutes = Number(e.target.value);
  document.getElementById('newGameMinutesVal').textContent = `${newGameDraft.minutes}분`;
});

document.getElementById('confirmAddGameBtn').addEventListener('click', () => {
  if (!newGameDraft.name.trim()) {
    showToast('게임 이름을 입력해주세요!');
    return;
  }
  if (newGameDraft.id) {
    const g = games.find(x => x.id === newGameDraft.id);
    if (g) {
      g.name = newGameDraft.name.trim();
      g.cover = newGameDraft.cover;
      g.minutes = newGameDraft.minutes;
      g.maxMinutes = newGameDraft.maxMinutes;
      g.image = newGameDraft.image;
    }
    saveGames();
    closeAllModals();
    renderGrid();
    showToast('게임 설정을 저장했어요!');
  } else {
    const id = 'g_custom_' + Date.now();
    games.push({
      id,
      name: newGameDraft.name.trim(),
      cover: newGameDraft.cover,
      minutes: newGameDraft.minutes,
      maxMinutes: newGameDraft.maxMinutes,
      image: newGameDraft.image,
      builtin: false,
    });
    saveGames();
    closeAllModals();
    renderGrid();
    showToast('새 보드게임이 추가되었어요!');
  }
});

/* ------------------------- 쉬는 시간 설정 ------------------------- */

function openRecessSettingsModal() {
  document.getElementById('recessEndTimeInput').value = recess.endTime;
  document.getElementById('recessAlertTimeInput').value = recess.alertTime;
  document.getElementById('recessMessageInput').value = recess.message || DEFAULT_RECESS_MESSAGE;
  document.getElementById('recessSettingsModal').hidden = false;
}

document.getElementById('editRecessBtn').addEventListener('click', () => {
  requireAdminPin(openRecessSettingsModal);
});

document.getElementById('openRecessMessageKeyboardBtn').addEventListener('click', () =>
  openKeyboard('recessMessage', document.getElementById('recessMessageInput').value)
);

document.getElementById('startRecessBtn').addEventListener('click', () => {
  const endTime = document.getElementById('recessEndTimeInput').value;
  const alertTime = document.getElementById('recessAlertTimeInput').value;
  if (!endTime || !alertTime) {
    showToast('종료 시각과 알림 시작 시각을 모두 입력해주세요!');
    return;
  }
  recess.endTime = endTime;
  recess.alertTime = alertTime;
  recess.message = document.getElementById('recessMessageInput').value.trim() || DEFAULT_RECESS_MESSAGE;
  recess._warned = false;
  recess._ended = false;
  saveRecess();
  closeAllModals();
  tickRecess();
  showToast('쉬는 시간 설정을 저장했어요!');
});

/* ------------------------- 설정 (관리자) ------------------------- */

function openAdminConfigModal() {
  const penaltySlider = document.getElementById('overduePenaltyMinutesSlider');
  penaltySlider.value = config.overduePenaltyMinutes;
  document.getElementById('overduePenaltyMinutesVal').textContent = `${config.overduePenaltyMinutes}분`;

  const groupSlider = document.getElementById('groupCountSlider');
  groupSlider.value = config.groupCount;
  document.getElementById('groupCountVal').textContent = `${config.groupCount}모둠`;

  const studentSlider = document.getElementById('studentCountSlider');
  studentSlider.value = config.studentCount;
  document.getElementById('studentCountVal').textContent = `${config.studentCount}번`;

  document.getElementById('adminConfigModal').hidden = false;
}

document.getElementById('openAdminConfigBtn').addEventListener('click', () => {
  requireAdminPin(openAdminConfigModal);
});

document.getElementById('overduePenaltyMinutesSlider').addEventListener('input', (e) => {
  document.getElementById('overduePenaltyMinutesVal').textContent = `${e.target.value}분`;
});

document.getElementById('groupCountSlider').addEventListener('input', (e) => {
  document.getElementById('groupCountVal').textContent = `${e.target.value}모둠`;
});

document.getElementById('studentCountSlider').addEventListener('input', (e) => {
  document.getElementById('studentCountVal').textContent = `${e.target.value}번`;
});

document.getElementById('saveAdminConfigBtn').addEventListener('click', () => {
  config.overduePenaltyMinutes = Number(document.getElementById('overduePenaltyMinutesSlider').value);
  config.groupCount = Number(document.getElementById('groupCountSlider').value);
  config.studentCount = Number(document.getElementById('studentCountSlider').value);
  saveConfig();
  closeAllModals();
  showToast('설정을 저장했어요!');
});

/* ------------------------- 대여 통계 ------------------------- */

function formatHistoryTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${period} ${h12}:${mm}`;
}

function openStatsModal() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayCount = history.filter(h => h.returnedAt >= todayStart).length;

  document.getElementById('statsTodayCount').textContent = todayCount;
  document.getElementById('statsTotalCount').textContent = history.length;

  const countsByGame = {};
  history.forEach(h => {
    countsByGame[h.gameName] = (countsByGame[h.gameName] || 0) + 1;
  });
  const ranked = Object.entries(countsByGame).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const rankList = document.getElementById('statsRankList');
  rankList.innerHTML = '';
  if (ranked.length === 0) {
    rankList.innerHTML = '<p class="stats-empty">아직 대여 기록이 없어요</p>';
  } else {
    ranked.forEach(([name, count], i) => {
      const row = document.createElement('div');
      row.className = 'stats-rank-row';
      row.innerHTML = `<span class="stats-rank-num">${i + 1}</span><span class="stats-rank-name">${escapeHtml(name)}</span><span class="stats-rank-count">${count}회</span>`;
      rankList.appendChild(row);
    });
  }

  const historyList = document.getElementById('statsHistoryList');
  historyList.innerHTML = '';
  const recent = history.slice(-15).reverse();
  if (recent.length === 0) {
    historyList.innerHTML = '<p class="stats-empty">아직 대여 기록이 없어요</p>';
  } else {
    recent.forEach(h => {
      const row = document.createElement('div');
      row.className = 'stats-history-row';
      const renterText = h.renter ? ` · ${escapeHtml(h.renter)}` : '';
      row.innerHTML = `<span class="stats-history-name">${escapeHtml(h.gameName)}${renterText}</span><span class="stats-history-meta">${formatHistoryTime(h.returnedAt)}</span>`;
      historyList.appendChild(row);
    });
  }

  document.getElementById('statsModal').hidden = false;
}

document.getElementById('openStatsBtn').addEventListener('click', () => {
  requireAdminPin(openStatsModal);
});

/* ------------------------- 검색 / 필터 ------------------------- */

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderGrid();
  });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  document.getElementById('clearSearchBtn').hidden = !searchQuery;
  renderGrid();
});

document.getElementById('clearSearchBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').hidden = true;
  renderGrid();
});

document.getElementById('openSearchKeyboardBtn').addEventListener('click', () => openKeyboard('search', searchQuery));

/* ------------------------- 가상 키보드 ------------------------- */

const KO_ROWS = [
  ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ'],
  ['ㅋ','ㅌ','ㅍ','ㅎ','ㄲ','ㄸ','ㅃ','ㅆ','ㅉ'],
  ['ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅣ'],
  ['ㅐ','ㅒ','ㅔ','ㅖ','ㅘ','ㅙ','ㅚ','ㅝ','ㅞ','ㅟ','ㅢ'],
];
const NUM_ROWS = [
  ['1','2','3','4','5'],
  ['6','7','8','9','0'],
];

function renderKeyboardBody() {
  const body = document.getElementById('keyboardBody');
  body.innerHTML = '';
  const rows = kbMode === 'ko' ? KO_ROWS : NUM_ROWS;
  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach(ch => {
      const key = document.createElement('button');
      key.className = 'kb-key';
      key.textContent = ch;
      key.addEventListener('click', () => {
        composer.typeChar(ch);
        updateKeyboardPreview();
      });
      rowEl.appendChild(key);
    });
    body.appendChild(rowEl);
  });
}

document.querySelectorAll('.kb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.kb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    kbMode = tab.dataset.mode;
    renderKeyboardBody();
  });
});

function updateKeyboardPreview() {
  const text = composer.getText();
  const preview = document.getElementById('keyboardPreview');
  preview.textContent = text || '입력해주세요...';

  if (keyboardTarget === 'gameName') {
    newGameDraft.name = text;
    const input = document.getElementById('newGameNameInput');
    input.value = text;
    input.parentElement.classList.toggle('filled', !!text);
  } else if (keyboardTarget === 'search') {
    searchQuery = text;
    document.getElementById('searchInput').value = text;
    document.getElementById('clearSearchBtn').hidden = !text;
    renderGrid();
  } else if (keyboardTarget === 'recessMessage') {
    document.getElementById('recessMessageInput').value = text;
  }
}

function openKeyboard(target, initialText) {
  keyboardTarget = target;
  composer = new HangulComposer(initialText || '');
  kbMode = 'ko';
  document.querySelectorAll('.kb-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.kb-tab[data-mode="ko"]').classList.add('active');
  renderKeyboardBody();
  updateKeyboardPreview();
  document.getElementById('keyboardModal').hidden = false;
}

document.getElementById('openGameNameKeyboardBtn').addEventListener('click', () => openKeyboard('gameName', newGameDraft ? newGameDraft.name : ''));

document.getElementById('kbSpaceBtn').addEventListener('click', () => { composer.space(); updateKeyboardPreview(); });
document.getElementById('kbBackspaceBtn').addEventListener('click', () => { composer.backspace(); updateKeyboardPreview(); });
document.getElementById('kbClearBtn').addEventListener('click', () => { composer.clear(); updateKeyboardPreview(); });
document.getElementById('kbDoneBtn').addEventListener('click', () => {
  document.getElementById('keyboardModal').hidden = true;
});

/* ------------------------- 선생님 PIN 확인 ------------------------- */

let pinSuccessCallback = null;

function requireAdminPin(onSuccess) {
  pinSuccessCallback = onSuccess;
  const pinInput = document.getElementById('pinInput');
  pinInput.value = '';
  document.getElementById('pinModal').hidden = false;
  pinInput.focus();
}

function deleteGame(gameId) {
  games = games.filter(g => g.id !== gameId);
  delete rentals[gameId];
  saveGames(); saveRentals();
  renderGrid();
  showToast('게임을 삭제했어요');
}

function confirmPinAndProceed() {
  const pinInput = document.getElementById('pinInput');
  if (pinInput.value !== ADMIN_PIN) {
    showToast('PIN이 올바르지 않아요');
    pinInput.value = '';
    pinInput.focus();
    return;
  }
  const callback = pinSuccessCallback;
  pinSuccessCallback = null;
  pinInput.value = '';
  closeAllModals();
  if (callback) callback();
}

document.getElementById('confirmPinBtn').addEventListener('click', confirmPinAndProceed);
document.getElementById('pinInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmPinAndProceed();
});

/* ------------------------- 모달 공통 ------------------------- */

function closeAllModals() {
  document.querySelectorAll('.overlay').forEach(o => o.hidden = true);
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.overlay').hidden = true;
  });
});

document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
});

/* ------------------------- 초기화 ------------------------- */

renderGrid();
