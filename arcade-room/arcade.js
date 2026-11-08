// The arcade room (reimertek.com's front page): the carousel and list controller.
// Owns where the carousel is, moves it (swipe, drag, arrow keys, the on-screen buttons
// and dots), keeps the title card in step, switches between the CABINETS room and the
// LIST of cards, filters both by category, sorts the list, and hands the room's drawing
// to the 3D renderer or a plain 2D one (no WebGL2, or reduced motion asked for).
//
// Stores nothing: no cookies, no localStorage. The address carries the state instead,
// as plain tokens joined by dots: #ring-reaper (a cabinet), #puzzle.crosswire (a filter
// and a cabinet), #list, #list.puzzle. SHARE always shares #<game-id>.
import { curve, layoutFor, wrapD, paintWindowView, paintCarpet } from './shared.js?v=0.4.0';

const data = JSON.parse(document.getElementById('cabinet-data').textContent);
const games = data.games;
const CATS = data.categories;
const N = games.length;
const byId = new Map(games.map((g, i) => [g.id, i]));
// a renamed game's old deep links still find it (#starwake is RING REAPER); an alias never shadows a real id
for (const [i, g] of games.entries()) for (const a of g.aliases || []) if (!byId.has(a)) byId.set(a, i);
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('room');
const flatRoot = $('flat');
const cardWrap = $('card-wrap');
const card = $('card');
const cardInner = $('card-inner');
const playLink = $('play');
const dotsRoot = $('dots');
const toolbar = $('toolbar');
const boot = $('boot');
const shareBtn = $('share');
const toastEl = $('toast');
const listEl = $('list');
const cardsEl = $('cards');
const chipsEl = $('chips');
const sortEl = $('sort');
const emptyEl = $('empty');
const filterPill = $('filter-pill');
const viewBtns = [...document.querySelectorAll('[data-view]')];
const lcards = new Map([...cardsEl.children].map((li) => [li.dataset.id, li]));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
function hasWebGL2() {
	try {
		const c = document.createElement('canvas');
		const gl = c.getContext('webgl2');
		if (!gl) return false;
		const lose = gl.getExtension('WEBGL_lose_context');
		if (lose) lose.loseContext();
		return true;
	} catch (e) {
		return false;
	}
}
const mode = params.has('2d') || reduceMotion || !hasWebGL2() ? '2d' : '3d';
document.documentElement.dataset.mode = mode;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------ the ring */
// The cabinets the carousel spins through: those matching the filter, NEWEST FIRST
// (Evrtek: "The arcade should always feature newest games first"), by release date, the
// cabinet number breaking a tie. Slot 0 is the newest, and the room opens on it.
// pos and target count ring slots. Seven or more and it wraps round like a turntable;
// fewer and it runs end to end (a wrap that small would happen in plain sight).
let filter = 'all';
let ring = [];
let M = N;
let wraps = true;
const slotOf = new Array(N).fill(-1);
const inFilter = (g, f = filter) => f === 'all' || g.categories.includes(f);
const newestFirst = (a, b) => games[b].released.localeCompare(games[a].released) || +games[b].num - +games[a].num;
const byNewest = games.map((g, i) => i).sort(newestFirst);
function buildRing() {
	ring = byNewest.filter((i) => inFilter(games[i]));
	slotOf.fill(-1);
	ring.forEach((gi, s) => { slotOf[gi] = s; });
	M = ring.length;
	wraps = M >= 7;
}
const modM = (n) => ((n % M) + M) % M;
const slotIndex = (p) => (wraps ? modM(Math.round(p)) : Math.max(0, Math.min(M - 1, Math.round(p))));
const gameAt = (p) => ring[slotIndex(p)];

/* ------------------------------------------------------------ state */
let pos = 0;
let target = 0;
let tween = null;
let view = null;
let viewMode = 'cabinets';
let sortMode = 'newest';
let morph = null; // a short blend when the ring changes under the cabinets

function setTarget(t) {
	if (!wraps) t = Math.max(0, Math.min(M - 1, t));
	target = t;
	const dist = Math.abs(t - pos);
	if (reduceMotion || dist < 0.001 || viewMode !== 'cabinets') {
		pos = t;
		tween = null;
	} else {
		tween = { from: pos, to: t, t0: performance.now(), dur: 360 + 170 * Math.min(dist, 4), ease: dist > 1.5 ? easeInOut : easeOut };
	}
	showCard(gameAt(t));
}
function go(step) {
	let t = Math.round(target) + step;
	if (!wraps) t = t > M - 1 ? 0 : t < 0 ? M - 1 : t;
	setTarget(t);
}
// Bring game gi to the front, the short way round.
function goTo(gi) {
	const s = slotOf[gi];
	if (s < 0) return;
	if (!wraps) { setTarget(s); return; }
	let delta = s - modM(Math.round(target));
	if (delta > M / 2) delta -= M;
	if (delta < -M / 2) delta += M;
	if (delta) setTarget(Math.round(target) + delta);
}
function play() {
	playLink.click();
}

// Where game i stands relative to the front, in cabinets (null: filtered out).
function dOf(i) {
	const s = slotOf[i];
	const dNew = s < 0 ? null : wraps ? wrapD(s, pos, M) : s - pos;
	if (morph && dNew !== null && morph.from[i] !== null) {
		const k = Math.min(1, (performance.now() - morph.t0) / 450);
		return morph.from[i] + (dNew - morph.from[i]) * easeInOut(k);
	}
	return dNew;
}

/* ------------------------------------------------------------ the address */
function parseHash() {
	let raw = '';
	try { raw = decodeURIComponent(location.hash.replace(/^#/, '')).trim().toLowerCase(); } catch (e) { /* bad escape */ }
	const out = { view: null, filter: null, game: -1 };
	for (const tok of raw.split('.').filter(Boolean)) {
		if (tok === 'list' || tok === 'cabinets') out.view = tok;
		else if (tok === 'all' || CATS.some((c) => c.id === tok)) out.filter = tok;
		else if (byId.has(tok)) out.game = byId.get(tok);
	}
	return out;
}
// Room: [filter.]game. List: list[.filter]. Debounced, and replaceState so moving
// through cabinets never piles up Back-button history.
let hashTimer = 0;
function syncHash() {
	clearTimeout(hashTimer);
	hashTimer = setTimeout(() => {
		const t = [];
		if (viewMode === 'list') t.push('list');
		if (filter !== 'all') t.push(filter);
		if (viewMode !== 'list' && cardIdx >= 0) t.push(games[cardIdx].id);
		const h = t.join('.');
		if (location.hash.slice(1) === h) return;
		try { history.replaceState(history.state, '', location.pathname + location.search + (h ? '#' + h : '')); } catch (e) { /* rate-limited; skip */ }
	}, 300);
}
function linkFor(g) {
	return (data.shareBase || location.origin + location.pathname) + '#' + g.id;
}

/* ------------------------------------------------------------ title card */
let cardIdx = -1;
let cardToken = 0;
function fillCard(i) {
	const g = games[i];
	card.style.setProperty('--trim', g.trim);
	stage.style.setProperty('--trim', g.trim);
	card.querySelector('.num').textContent = 'CABINET ' + g.num;
	const st = card.querySelector('.status');
	st.textContent = g.status;
	st.dataset.status = g.status.toLowerCase();
	card.querySelector('.name').textContent = g.name;
	card.querySelector('.desc').textContent = g.blurb;
	playLink.href = g.href;
	playLink.setAttribute('aria-label', 'Play ' + g.name + ' (opens in a new tab)');
	shareBtn.setAttribute('aria-label', 'Share a link to ' + g.name);
	dotsRoot.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', +b.dataset.i === i ? 'true' : 'false'));
	markFocus();
}
function showCard(i, animate = true) {
	if (i === cardIdx) return;
	const prev = cardIdx;
	cardIdx = i;
	syncHash();
	if (prev < 0 || !animate || reduceMotion || viewMode !== 'cabinets' || !cardInner.animate) {
		cardInner.getAnimations && cardInner.getAnimations().forEach((a) => a.cancel());
		fillCard(i);
		return;
	}
	let dir = slotOf[i] - slotOf[prev];
	if (wraps) {
		if (dir > M / 2) dir -= M;
		if (dir < -M / 2) dir += M;
	}
	dir = Math.sign(dir) || 1;
	const token = ++cardToken;
	cardInner.getAnimations().forEach((a) => a.cancel());
	cardInner
		.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 22}px)` }], { duration: 130, easing: 'ease-in', fill: 'forwards' })
		.finished.then(() => {
			if (token !== cardToken) return;
			fillCard(cardIdx);
			cardInner.getAnimations().forEach((a) => a.cancel());
			cardInner.animate([{ opacity: 0, transform: `translateX(${dir * 22}px)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
		})
		.catch(() => {});
}

// one dot per cabinet, newest first like the ring; the dots outside the filter are hidden
byNewest.forEach((i) => {
	const g = games[i];
	const b = document.createElement('button');
	b.type = 'button';
	b.dataset.i = i;
	b.style.setProperty('--trim', g.trim);
	b.setAttribute('aria-label', 'Cabinet ' + g.num + ': ' + g.name);
	b.addEventListener('click', () => goTo(i));
	dotsRoot.append(b);
});

/* ------------------------------------------------------------ sharing */
// On a phone (touch screen with a share sheet) SHARE opens the share sheet; anywhere
// else it copies the link and says so. If the clipboard is refused, the link itself
// shows in the toast so it can be copied by hand.
let toastTimer = 0;
function toast(msg, long) {
	const host = viewMode === 'list' ? $('list-toast') : toastEl;
	[toastEl, $('list-toast')].forEach((t) => t !== host && t.classList.remove('show'));
	host.textContent = msg;
	host.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => host.classList.remove('show'), long ? 6000 : 1800);
}
function legacyCopy(text) {
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.setAttribute('readonly', '');
	ta.style.cssText = 'position:fixed;top:-200px;left:0;opacity:0';
	document.body.append(ta);
	ta.select();
	let ok = false;
	try { ok = document.execCommand('copy'); } catch (e) { /* not allowed */ }
	ta.remove();
	return ok;
}
function copyLink(url) {
	const done = () => toast('Link copied');
	const fallback = () => (legacyCopy(url) ? done() : toast(url, true));
	if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback);
	else fallback();
}
function share(gi) {
	const g = games[gi];
	const url = linkFor(g);
	if (navigator.share && matchMedia('(pointer: coarse)').matches) {
		navigator.share({ title: g.name + ' | Reimertek Studios', url }).catch((err) => {
			if (!err || err.name !== 'AbortError') copyLink(url);
		});
	} else {
		copyLink(url);
	}
}
shareBtn.addEventListener('click', () => share(cardIdx));

/* ------------------------------------------------------------ the list */
const sorters = {
	newest: newestFirst,
	az: (a, b) => games[a].name.localeCompare(games[b].name),
	number: (a, b) => +games[a].num - +games[b].num,
};
function applyList() {
	const order = games.map((g, i) => i).sort(sorters[sortMode] || sorters.newest);
	let shown = 0;
	for (const i of order) {
		const li = lcards.get(games[i].id);
		li.hidden = !inFilter(games[i]);
		if (!li.hidden) shown++;
		cardsEl.append(li);
	}
	emptyEl.hidden = shown > 0;
	markFocus();
}
function markFocus() {
	const id = cardIdx >= 0 ? games[cardIdx].id : '';
	lcards.forEach((li, key) => li.classList.toggle('is-focus', key === id));
}
function scrollToFocus() {
	const li = cardIdx >= 0 && lcards.get(games[cardIdx].id);
	if (!li || li.hidden) { listEl.scrollTop = 0; return; }
	const lr = listEl.getBoundingClientRect(), r = li.getBoundingClientRect();
	listEl.scrollTop += r.top - lr.top - (lr.height - r.height) / 2;
}
cardsEl.addEventListener('click', (e) => {
	const li = e.target.closest('.lcard');
	if (!li) return;
	const sb = e.target.closest('[data-share]');
	if (sb) { share(byId.get(sb.dataset.share)); return; }
	if (e.target.closest('a')) return;
	// picking a card makes it "your place": the room opens on it
	const gi = byId.get(li.dataset.id);
	if (slotOf[gi] >= 0) { pos = target = slotOf[gi]; tween = null; showCard(gi, false); }
});
sortEl.addEventListener('change', () => { sortMode = sortEl.value; applyList(); });
chipsEl.addEventListener('click', (e) => {
	const b = e.target.closest('[data-cat]');
	if (b) setFilter(b.dataset.cat);
});
filterPill.addEventListener('click', () => setFilter('all'));

function setFilter(cat, { quiet = false } = {}) {
	if (cat !== 'all' && !CATS.some((c) => c.id === cat)) cat = 'all';
	if (cat === filter && ring.length) return;
	const keep = cardIdx >= 0 ? cardIdx : ring.length ? gameAt(target) : N - 1;
	const from = games.map((g, i) => (ring.length ? dOf(i) : null));
	filter = cat;
	buildRing();
	let s = slotOf[keep];
	if (s < 0) s = 0; // the newest in the filter
	pos = target = s;
	tween = null;
	if (!quiet && viewMode === 'cabinets') morph = { t0: performance.now(), from };
	refreshFilterUI();
	applyList();
	cardIdx = -1;
	showCard(ring[s], false);
	syncHash();
}
function refreshFilterUI() {
	chipsEl.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === filter)));
	dotsRoot.querySelectorAll('button').forEach((b) => { b.hidden = slotOf[+b.dataset.i] < 0; });
	const label = filter === 'all' ? '' : CATS.find((c) => c.id === filter).label;
	filterPill.hidden = !label || viewMode === 'list';
	filterPill.querySelector('.label').textContent = label;
	$('prev').hidden = $('next').hidden = M < 2;
	filterPill.setAttribute('aria-label', label ? 'Showing ' + label + ' only. Show all games' : 'Show all games');
}

function setView(v) {
	if (v !== 'list') v = 'cabinets';
	if (v === viewMode) return;
	viewMode = v;
	document.documentElement.dataset.view = v;
	viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
	listEl.hidden = v !== 'list';
	filterPill.hidden = filter === 'all' || v === 'list';
	if (v === 'list') {
		tween = null;
		pos = target = Math.round(target);
		applyList();
		requestAnimationFrame(scrollToFocus);
	} else {
		measure();
	}
	syncHash();
}
viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

/* ------------------------------------------------------------ the 2D room */
function createFlat() {
	flatRoot.hidden = false;
	canvas.hidden = true;
	const back = document.createElement('div');
	back.className = 'flat-back';
	const win = paintWindowView({ width: 2304 });
	win.className = 'flat-window';
	const sign = new Image();
	sign.src = data.brand.lockupSvg;
	sign.alt = '';
	sign.className = 'flat-sign';
	const floor = document.createElement('div');
	floor.className = 'flat-floor';
	floor.style.backgroundImage = 'url(' + paintCarpet(512).toDataURL() + ')';
	back.append(win, sign, floor);
	flatRoot.append(back);
	const els = games.map((g, i) => {
		const el = document.createElement('div');
		el.className = 'c2';
		el.dataset.i = i;
		el.style.setProperty('--trim', g.trim);
		el.style.setProperty('--trim2', g.trim2);
		el.style.setProperty('--body', g.body);
		el.innerHTML =
			'<div class="c2-marquee"><img alt="" decoding="async" loading="lazy" src="' + g.marquee + '"></div>' +
			'<div class="c2-screen"><img alt="" decoding="async" loading="lazy" src="' + g.attract + '"></div>' +
			'<div class="c2-deck"><i></i><b></b><b></b><b></b></div><div class="c2-door"><span></span></div>';
		flatRoot.append(el);
		return el;
	});
	let L = layoutFor(1, 1), W = 1;
	return {
		resize(w, h, top, bottom, cx = w / 2) {
			W = w;
			L = layoutFor(w, h);
			flatRoot.style.setProperty('--cx', cx + 'px');
			flatRoot.style.setProperty('--ch', Math.min((bottom - top) * 0.86, 620) + 'px');
			flatRoot.style.setProperty('--mid', (top + bottom) / 2 + 'px');
		},
		frame(ctx) {
			els.forEach((el, i) => {
				const d = ctx.d(i);
				const a = d === null ? 99 : Math.abs(d), s = Math.sign(d || 0);
				const vis = a < L.show;
				el.style.visibility = vis ? 'visible' : 'hidden';
				if (!vis) return;
				const x = s * curve(L.X, a, true) * (W / 2);
				const sc = curve(L.S, a, false);
				el.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${sc.toFixed(3)})`;
				el.style.zIndex = String(10 - Math.round(a * 2));
				el.style.filter = a < 0.5 ? 'none' : `brightness(${(1 - Math.min(a, 2) * 0.22).toFixed(2)})`;
			});
		},
		pick(x, y) {
			const hit = document.elementFromPoint(x, y);
			const el = hit && hit.closest('.c2');
			if (!el) return null;
			return { index: +el.dataset.i, part: hit.closest('.c2-screen, .c2-marquee') ? 'screen' : 'body' };
		},
		pxPerCab: () => L.X[1] * (W / 2),
		pointOf(i) {
			if (els[i].style.visibility === 'hidden') return null;
			const r = els[i].querySelector('.c2-screen').getBoundingClientRect();
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		},
		info: () => ({ layout: L.name }),
	};
}

/* ------------------------------------------------------------ layout */
// The free space for the cabinet: below the toolbar, and above the title card, or (on a
// landscape phone, where the card sits to the right) left of it, full height.
function measure() {
	const sr = stage.getBoundingClientRect();
	const cw = cardWrap.getBoundingClientRect();
	const top = toolbar.getBoundingClientRect().bottom - sr.top;
	const side = cw.left - sr.left > sr.width * 0.4;
	const bottom = side ? sr.height - 8 : cw.top - sr.top;
	const right = side ? cw.left - sr.left - 8 : sr.width;
	stage.style.setProperty('--free-mid', ((top + bottom) / 2).toFixed(0) + 'px');
	stage.style.setProperty('--free-right', (sr.width - right).toFixed(0) + 'px');
	if (view) view.resize(sr.width, sr.height, top, bottom, right / 2, right);
}

/* ------------------------------------------------------------ input */
let drag = null;
let suppressClick = false;
const inRoom = () => viewMode === 'cabinets';
stage.addEventListener('pointerdown', (e) => {
	// Swipes may start anywhere on the room, the arrow buttons included: on a phone they
	// sit right where a thumb begins a swipe. The card, toolbar and links stay taps.
	if (!inRoom() || e.button !== 0 || e.target.closest('a, #card-wrap, #toolbar, #list')) return;
	suppressClick = false;
	drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: pos, t: performance.now(), x: e.clientX, v: 0, moved: false };
});
stage.addEventListener('pointermove', (e) => {
	if (!drag || e.pointerId !== drag.id) {
		if (!drag && e.pointerType === 'mouse' && inRoom()) hover(e);
		return;
	}
	const dx = e.clientX - drag.x0;
	if (!drag.moved) {
		if (Math.abs(dx) < 8) return;
		if (Math.abs(e.clientY - drag.y0) > Math.abs(dx)) { drag = null; return; }
		drag.moved = true;
		tween = null;
		try { stage.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
		stage.classList.add('dragging');
	}
	const now = performance.now();
	const per = dragPer();
	let p = drag.p0 - dx / per;
	if (!wraps) p = Math.max(-0.35, Math.min(M - 1 + 0.35, p));
	const dt = Math.max(1, now - drag.t);
	drag.v = 0.7 * drag.v + 0.3 * ((-(e.clientX - drag.x) / per) / dt) * 1000;
	drag.t = now;
	drag.x = e.clientX;
	pos = p;
	target = p;
	showCard(gameAt(p));
});
function endDrag(e) {
	if (!drag || e.pointerId !== drag.id) return;
	const d = drag;
	drag = null;
	stage.classList.remove('dragging');
	if (!d.moved) return;
	suppressClick = true;
	// One swipe, one cabinet: a quick flick always moves one; a long drag can move more,
	// and momentum only nudges, it never adds a whole extra cabinet.
	const start = Math.round(d.p0);
	let snap = Math.round(pos + Math.max(-0.35, Math.min(0.35, d.v * 0.05)));
	if (snap === start && Math.abs(d.v) > 1) snap = start + Math.sign(d.v);
	snap = Math.max(start - 3, Math.min(start + 3, snap));
	setTarget(snap);
}
// The turntable is a little heavier than the finger: about 1.4 screen-spacings of
// drag per cabinet, so a normal swipe lands on the next one.
function dragPer() {
	return Math.max(90, view.pxPerCab() * 1.4);
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('click', (e) => {
	if (suppressClick) { suppressClick = false; return; }
	if (!inRoom() || e.target.closest('a, button, #card-wrap, #toolbar, #list') || !view) return;
	const hit = view.pick(e.clientX, e.clientY);
	if (!hit || slotOf[hit.index] < 0) return;
	if (hit.index === gameAt(target) && Math.abs(pos - target) < 0.2) {
		if (hit.part === 'screen') play();
	} else {
		goTo(hit.index);
	}
});
let hoverAt = 0;
function hover(e) {
	const now = performance.now();
	if (now - hoverAt < 60 || !view || e.target.closest('a, button, #card-wrap, #toolbar')) return;
	hoverAt = now;
	const hit = view.pick(e.clientX, e.clientY);
	const ok = hit && slotOf[hit.index] >= 0;
	const front = ok && hit.index === gameAt(target);
	stage.style.cursor = ok && (!front || hit.part === 'screen') ? 'pointer' : '';
}

// A swipe that began on an arrow is a swipe, not a press (keyboard presses have detail 0).
$('prev').addEventListener('click', (e) => { if (e.detail === 0 || !suppressClick) go(-1); });
$('next').addEventListener('click', (e) => { if (e.detail === 0 || !suppressClick) go(1); });
document.addEventListener('keydown', (e) => {
	if (!inRoom() || e.altKey || e.ctrlKey || e.metaKey) return;
	if (e.target.closest && e.target.closest('select, input, textarea')) return;
	if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
	else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
	else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === stage) { e.preventDefault(); play(); }
});
// Following a link while already on the page (or editing the address) applies it.
window.addEventListener('hashchange', () => applyHash(parseHash()));
function applyHash(h) {
	if (h.filter) setFilter(h.filter);
	if (h.game >= 0) {
		if (slotOf[h.game] < 0) setFilter('all');
		if (viewMode === 'cabinets' && !h.view) goTo(h.game);
		else { pos = target = slotOf[h.game]; tween = null; showCard(h.game, false); }
	}
	if (h.view) setView(h.view);
	else if (h.game >= 0) setView('cabinets');
}

/* ------------------------------------------------------------ run */
let onScreen = true;
let lastBg = 0;
let lastT = performance.now();
const t0 = lastT;
const ctx = {
	d: dOf,
	lamp: { a: 0, b: 0, t: 0 },
};
function loop(now) {
	requestAnimationFrame(loop);
	const dt = Math.min(0.1, (now - lastT) / 1000);
	lastT = now;
	if (tween) {
		const k = Math.min(1, (now - tween.t0) / tween.dur);
		pos = tween.from + (tween.to - tween.from) * tween.ease(k);
		if (k >= 1) { pos = tween.to; tween = null; }
	}
	if (morph && now - morph.t0 > 450) morph = null;
	if (!onScreen || !view) return;
	// the list sits over a blurred room: redraw it slowly, just enough to catch art arriving
	if (viewMode !== 'cabinets') {
		if (now - lastBg < 400) return;
		lastBg = now;
	}
	const lo = Math.floor(pos);
	ctx.lamp.a = gameAt(lo);
	ctx.lamp.b = gameAt(lo + 1);
	ctx.lamp.t = wraps || lo + 1 <= M - 1 ? pos - lo : 0;
	view.frame(ctx, (now - t0) / 1000, dt);
}

function ready() {
	boot.classList.add('gone');
	stage.classList.add('live');
}

// Test and inspection hook, only with ?test in the address.
if (params.has('test')) {
	window.__arcade = {
		mode: () => document.documentElement.dataset.mode,
		state: () => ({ pos, target, focused: gameAt(target), id: games[gameAt(target)].id, view: viewMode, filter, ring: ring.map((i) => games[i].id), tweening: !!tween, info: view && view.info() }),
		go, goTo, setView, setFilter,
		pointOf: (i) => (view ? view.pointOf(i) : null),
		screenRect: (i) => (view && view.screenRect ? view.screenRect(i) : null),
	};
}

// Start from the address: a filter, a cabinet, a view; otherwise the newest cabinet.
{
	const h = parseHash();
	filter = h.filter && h.filter !== 'all' ? h.filter : 'all';
	buildRing();
	if (h.game >= 0 && slotOf[h.game] < 0) { filter = 'all'; buildRing(); }
	const s = h.game >= 0 ? slotOf[h.game] : 0;
	pos = target = s;
	refreshFilterUI();
	applyList();
	cardIdx = -1;
	showCard(ring[s], false);
	if (h.view === 'list') setView('list');
	clearTimeout(hashTimer); // a plain load leaves the address alone
	document.documentElement.dataset.view = viewMode;
}

async function start() {
	if (mode === '3d') {
		try {
			const { createRoom3D } = await import('./room3d.js?v=0.4.0');
			view = await createRoom3D({ canvas, games, brand: data.brand, onFirstFrame: ready });
		} catch (err) {
			console.warn('3D room unavailable, using the 2D arcade', err);
			document.documentElement.dataset.mode = '2d';
			view = createFlat();
			ready();
		}
	} else {
		view = createFlat();
		ready();
	}
	measure();
	new ResizeObserver(measure).observe(stage);
	new ResizeObserver(measure).observe(cardWrap);
	if ('IntersectionObserver' in window) new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; }).observe(stage);
	requestAnimationFrame(loop);
}
start();
