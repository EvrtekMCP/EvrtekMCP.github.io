// Arcade landing preview: shared painters and carousel layout.
// No three.js in here, so the 2D fallback can use it without loading the 3D engine.
// Everything is drawn in code at run time; the only images used are the games' own
// cabinet art and the REIMERTEK STUDIOS Portal logo (SVG), both untouched.
// Round 2: everything paints at twice the old resolution, and the window view is a
// smooth painted sunrise rather than pixels.

export function makeCanvas(w, h) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return c;
}

export function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13; s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5; s >>>= 0;
		return s / 4294967296;
	};
}

export function loadImage(src) {
	return new Promise((ok, no) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => ok(img);
		img.onerror = () => no(new Error('image failed: ' + src));
		img.src = src;
	});
}

/* ------------------------------------------------------------------ layout */

// Where each cabinet stands, by its distance (in cabinets) from the focused one.
// X is in screen half-widths (so it holds on any screen), Z in metres back from the
// front, R the turn away from the camera in radians, S the scale. Catmull-Rom between
// the knots keeps the motion smooth as the carousel spins through.
export const LAYOUTS = {
	wide: { name: 'wide', fov: 34, fit: 0.9, pitch: 7, X: [0, 0.43, 0.78, 1.18, 1.6], Z: [0, -0.9, -2.0, -3.2, -4.4], R: [0, 0.42, 0.78, 1.05, 1.25], S: [1, 0.8, 0.66, 0.56, 0.5], show: 3.3, range: 2 },
	tall: { name: 'tall', fov: 40, fit: 0.9, pitch: 6, X: [0, 0.94, 1.75, 2.5, 3.2], Z: [0, -0.9, -1.9, -3.0, -4.0], R: [0, 0.55, 0.85, 1.05, 1.2], S: [1, 0.78, 0.64, 0.56, 0.5], show: 2.6, range: 1 },
};

export function layoutFor(w, h) {
	return w / h < 0.85 ? LAYOUTS.tall : LAYOUTS.wide;
}

export function curve(K, a, odd) {
	const n = K.length - 1;
	if (a >= n) return K[n] + (a - n) * (K[n] - K[n - 1]);
	const i = Math.floor(a), t = a - i;
	const p0 = i === 0 ? (odd ? -K[1] : K[1]) : K[i - 1];
	const p1 = K[i], p2 = K[i + 1];
	const p3 = i + 2 <= n ? K[i + 2] : 2 * K[n] - K[n - 1];
	const t2 = t * t, t3 = t2 * t;
	return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Signed distance from the focused slot, wrapped so the ring has no ends.
export function wrapD(i, pos, n) {
	let d = (i - pos) % n;
	if (d < 0) d += n;
	if (d >= n / 2) d -= n;
	return d;
}

/* ---------------------------------------------------------------- painters */

// The view through the big window: a sunrise over a digital world, painted smooth.
// Drawn in a 1536 x 512 design space and scaled to whatever size is asked for.
// The "digital" is in the land: a field of lit dots in perspective and a lit skyline,
// never a glowing grid.
export function paintWindowView({ width = 3072, mullions = true } = {}) {
	const BW = 1536, BH = 512, HZ = 318, SX = BW / 2;
	const k = width / BW;
	const c = makeCanvas(Math.round(BW * k), Math.round(BH * k));
	const g = c.getContext('2d');
	g.scale(k, k);
	const r = rng(7);

	// sky
	const sky = g.createLinearGradient(0, 0, 0, HZ);
	sky.addColorStop(0, '#060519');
	sky.addColorStop(0.22, '#100c33');
	sky.addColorStop(0.42, '#271852');
	sky.addColorStop(0.6, '#5a2468');
	sky.addColorStop(0.76, '#a8386c');
	sky.addColorStop(0.89, '#ec6c58');
	sky.addColorStop(1, '#ffbf5c');
	g.fillStyle = sky;
	g.fillRect(0, 0, BW, HZ + 1);

	// stars, fading out toward the glow
	for (let i = 0; i < 260; i++) {
		const x = r() * BW, y = Math.pow(r(), 1.8) * HZ * 0.62, s = 0.5 + r() * 1.3;
		g.globalAlpha = (0.25 + 0.75 * r()) * (1 - y / (HZ * 0.7));
		g.fillStyle = r() < 0.15 ? '#ffe7b0' : '#dfe4ff';
		g.beginPath();
		g.arc(x, y, s, 0, Math.PI * 2);
		g.fill();
	}
	g.globalAlpha = 1;

	// the big soft glow behind the sun
	const glow = g.createRadialGradient(SX, HZ, 10, SX, HZ, 520);
	glow.addColorStop(0, 'rgba(255,196,110,0.75)');
	glow.addColorStop(0.25, 'rgba(255,128,96,0.32)');
	glow.addColorStop(0.6, 'rgba(190,60,120,0.12)');
	glow.addColorStop(1, 'rgba(120,40,120,0)');
	g.fillStyle = glow;
	g.fillRect(0, 0, BW, HZ);

	// long soft clouds, lit from underneath
	const cloud = (x, y, w, h, a) => {
		const cg = g.createLinearGradient(0, y - h, 0, y + h);
		cg.addColorStop(0, `rgba(120,60,140,${0.0})`);
		cg.addColorStop(0.45, `rgba(140,64,140,${a * 0.55})`);
		cg.addColorStop(0.8, `rgba(255,140,120,${a})`);
		cg.addColorStop(1, 'rgba(255,170,120,0)');
		g.fillStyle = cg;
		g.beginPath();
		g.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
		g.fill();
	};
	cloud(240, 150, 190, 13, 0.55); cloud(400, 182, 150, 9, 0.5); cloud(1150, 132, 230, 14, 0.5);
	cloud(1290, 196, 140, 9, 0.55); cloud(700, 96, 120, 7, 0.35); cloud(930, 218, 120, 8, 0.45);

	// the sun: a half disc sitting on the horizon, sliced near its base
	const SR = 128;
	const sun = makeCanvas(Math.ceil(SR * 2 * k) + 4, Math.ceil(SR * k) + 4);
	const s = sun.getContext('2d');
	s.scale(k, k);
	const sg = s.createLinearGradient(0, 0, 0, SR);
	sg.addColorStop(0, '#fff6c4');
	sg.addColorStop(0.45, '#ffcf5a');
	sg.addColorStop(1, '#ff7a3c');
	s.fillStyle = sg;
	s.beginPath();
	s.arc(SR + 1, SR + 1, SR, Math.PI, 0);
	s.closePath();
	s.fill();
	s.globalCompositeOperation = 'destination-out';
	for (let j = 0; j < 7; j++) {
		const y = SR * (0.5 + j * 0.075);
		const h = 1.5 + j * 1.6;
		s.fillRect(0, y, SR * 2 + 2, h);
	}
	g.drawImage(sun, SX - SR - 1, HZ - SR - 1, sun.width / k, sun.height / k);

	// far hills: smooth ridge, parted round the sun
	const ridge = (col, base, amp, seed, valley, yOff = 0) => {
		const rr = rng(seed);
		const ph = [rr() * 6, rr() * 6, rr() * 6];
		g.fillStyle = col;
		g.beginPath();
		g.moveTo(0, HZ + 1);
		for (let x = 0; x <= BW; x += 8) {
			const n = Math.sin(x / 170 + ph[0]) * 0.5 + Math.sin(x / 63 + ph[1]) * 0.3 + Math.sin(x / 29 + ph[2]) * 0.2;
			const v = valley ? Math.min(1, Math.pow(Math.abs(x - SX) / 330, 1.4)) : 1;
			g.lineTo(x, HZ - yOff - (base + amp * (0.5 + 0.5 * n)) * (0.12 + 0.88 * v));
		}
		g.lineTo(BW, HZ + 1);
		g.closePath();
		g.fill();
	};
	ridge('rgba(64,34,104,0.9)', 26, 46, 3, true);

	// a lit skyline either side: the digital city waking up
	const city = (x0, x1, seed) => {
		const rr = rng(seed);
		let x = x0;
		while (x < x1) {
			const w = 14 + rr() * 28, h = 30 + Math.pow(rr(), 1.6) * 110;
			g.fillStyle = '#20163e';
			g.fillRect(x, HZ - h, w, h);
			if (rr() < 0.3) g.fillRect(x + w / 2 - 1, HZ - h - 12 - rr() * 14, 2, 26);
			for (let wy = HZ - h + 7; wy < HZ - 6; wy += 9) {
				for (let wx = x + 4; wx < x + w - 5; wx += 7) {
					if (rr() < 0.32) {
						g.fillStyle = rr() < 0.55 ? 'rgba(255,206,120,0.85)' : 'rgba(120,232,255,0.8)';
						g.fillRect(wx, wy, 3, 4);
					}
				}
			}
			x += w + 2 + rr() * 8;
		}
	};
	city(150, 470, 21);
	city(1070, 1390, 22);
	ridge('#1a1232', 8, 22, 11, true);

	// a bright seam where the sun meets the world
	g.save();
	g.shadowColor = 'rgba(255,200,120,0.9)';
	g.shadowBlur = 18;
	g.fillStyle = 'rgba(255,214,150,0.7)';
	g.fillRect(0, HZ - 1, BW, 2);
	g.restore();

	// the ground: deep violet, a field of lit dots receding to the horizon
	const ground = g.createLinearGradient(0, HZ, 0, BH);
	ground.addColorStop(0, '#2a1450');
	ground.addColorStop(0.35, '#150c30');
	ground.addColorStop(1, '#09061a');
	g.fillStyle = ground;
	g.fillRect(0, HZ + 1, BW, BH - HZ);
	for (let zi = 0; zi < 15; zi++) {
		const z = 30 / Math.pow(1.27, zi);
		const y = HZ + 3 + 175 / z;
		if (y > BH + 4) break;
		const near = zi / 14;
		const rad = 0.7 + near * 2.4;
		for (let X = -80; X <= 80; X++) {
			const x = SX + (X * 38) / z;
			if (x < -10 || x > BW + 10) continue;
			const inSun = Math.abs(x - SX) < 70 + near * 120;
			g.fillStyle = inSun ? `rgba(255,198,110,${0.4 + 0.5 * near})` : `rgba(90,226,255,${0.16 + 0.5 * near})`;
			g.beginPath();
			g.arc(x, y, rad, 0, Math.PI * 2);
			g.fill();
		}
	}
	// the sun's reflection: soft gold bands narrowing toward us
	for (let j = 0; j < 16; j++) {
		const y = HZ + 6 + j * 11;
		const w = Math.max(14, 210 - j * 12) * (0.75 + 0.25 * r());
		const bg = g.createLinearGradient(SX - w / 2, 0, SX + w / 2, 0);
		bg.addColorStop(0, 'rgba(255,190,100,0)');
		bg.addColorStop(0.5, `rgba(255,200,120,${0.55 - j * 0.025})`);
		bg.addColorStop(1, 'rgba(255,190,100,0)');
		g.fillStyle = bg;
		g.fillRect(SX - w / 2 + (r() - 0.5) * 10, y, w, 2.4);
	}

	if (mullions) {
		const b = 16;
		g.fillStyle = '#0c0a1a';
		[BW / 3, (2 * BW) / 3].forEach((x) => g.fillRect(x - b / 2, 0, b, BH));
		g.fillRect(0, BH * 0.2, BW, b * 0.7);
		g.fillStyle = 'rgba(255,200,150,0.16)';
		[BW / 3, (2 * BW) / 3].forEach((x) => g.fillRect(x + b / 2 - 1.5, 0, 1.5, BH));
		const sh = g.createLinearGradient(0, 0, 0, BH * 0.12);
		sh.addColorStop(0, 'rgba(5,4,14,0.6)');
		sh.addColorStop(1, 'rgba(5,4,14,0)');
		g.fillStyle = sh;
		g.fillRect(0, 0, BW, BH * 0.12);
	}
	return c;
}

// Arcade carpet, muted: deep and dark with a scatter of soft confetti, so the
// cabinets do the shouting. Tiles seamlessly.
export function paintCarpet(size = 1024) {
	const c = makeCanvas(size, size);
	const g = c.getContext('2d');
	const k = size / 512;
	g.scale(k, k);
	g.fillStyle = '#0c0919';
	g.fillRect(0, 0, 512, 512);
	const r = rng(42);
	for (let i = 0; i < 1400; i++) {
		g.fillStyle = r() < 0.5 ? 'rgba(34,24,62,0.45)' : 'rgba(4,3,10,0.45)';
		g.fillRect(r() * 512, r() * 512, 1 + r() * 2.5, 1 + r() * 2.5);
	}
	const cols = ['#4fb8cc', '#c9a640', '#c0538a', '#7158c0', '#4aa86e'];
	g.globalAlpha = 0.34;
	for (let i = 0; i < 46; i++) {
		const x = r() * 512, y = r() * 512, s = 7 + r() * 11, rot = r() * Math.PI * 2, col = cols[i % cols.length], kind = (r() * 5) | 0;
		for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
			const px = x + ox, py = y + oy;
			if (px < -30 || px > 542 || py < -30 || py > 542) continue;
			confetti(g, kind, px, py, s, rot, col);
		}
	}
	g.globalAlpha = 1;
	return c;
}

function confetti(g, kind, x, y, s, rot, col) {
	g.save();
	g.translate(x, y);
	g.rotate(rot);
	g.strokeStyle = col;
	g.fillStyle = col;
	g.lineWidth = Math.max(1.6, s * 0.15);
	g.lineCap = 'round';
	g.lineJoin = 'round';
	g.beginPath();
	if (kind === 0) {
		g.moveTo(0, -s * 0.6); g.lineTo(s * 0.55, s * 0.4); g.lineTo(-s * 0.55, s * 0.4); g.closePath(); g.stroke();
	} else if (kind === 1) {
		g.moveTo(-s, 0);
		for (let j = 1; j <= 4; j++) g.quadraticCurveTo(-s + (j - 0.5) * (s / 2), (j % 2 ? -1 : 1) * s * 0.45, -s + j * (s / 2), 0);
		g.stroke();
	} else if (kind === 2) {
		g.arc(0, 0, s * 0.4, 0, Math.PI * 2); g.stroke();
	} else if (kind === 3) {
		for (let j = 0; j < 3; j++) { g.moveTo((j - 1) * s * 0.45 + s * 0.14, (j % 2) * s * 0.3); g.arc((j - 1) * s * 0.45, (j % 2) * s * 0.3, s * 0.14, 0, Math.PI * 2); }
		g.fill();
	} else {
		g.moveTo(-s * 0.5, -s * 0.2); g.lineTo(-s * 0.15, s * 0.25); g.lineTo(s * 0.15, -s * 0.25); g.lineTo(s * 0.5, s * 0.2); g.stroke();
	}
	g.restore();
}

// Cabinet side art: lacquer in the game's dark colour, two swooshes in its trim colours,
// and the studio's Portal mark as a maker's badge. Abstract on purpose: the game art
// itself stays on the marquee and screen, untouched. 512 x 1024 (2x).
export function paintSideArt({ body, trim, trim2, mark }) {
	const W = 256, H = 512, K = 2;
	const c = makeCanvas(W * K, H * K);
	const g = c.getContext('2d');
	g.scale(K, K);
	g.fillStyle = body;
	g.fillRect(0, 0, W, H);
	const sheen = g.createLinearGradient(0, 0, W, H);
	sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
	sheen.addColorStop(0.5, 'rgba(255,255,255,0.0)');
	sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
	g.fillStyle = sheen;
	g.fillRect(0, 0, W, H);
	const band = (col, w, a, y0, y1, bend) => {
		g.strokeStyle = col;
		g.globalAlpha = a;
		g.lineWidth = w;
		g.beginPath();
		g.moveTo(-30, y0);
		g.bezierCurveTo(W * 0.3, y0 - bend, W * 0.62, y1 + bend, W + 30, y1);
		g.stroke();
		g.globalAlpha = 1;
	};
	band(trim, 54, 0.95, H * 0.82, H * 0.38, 70);
	band(trim2, 16, 0.95, H * 0.82 + 44, H * 0.38 + 42, 70);
	band('#ffffff', 2.5, 0.45, H * 0.82 - 30, H * 0.38 - 30, 70);
	band(trim, 12, 0.7, H * 0.3, H * 0.1, 30);
	band(trim2, 5, 0.7, H * 0.3 + 16, H * 0.1 + 15, 30);
	const r = rng(body.length * 97 + trim.charCodeAt(2));
	for (let i = 0; i < 26; i++) {
		const x = r() * W, y = r() * H * 0.75, s = 0.8 + r() * 2;
		g.fillStyle = r() < 0.5 ? trim2 : '#ffffff';
		g.globalAlpha = 0.5 + 0.5 * r();
		g.fillRect(x - s / 2, y - s * 2, s, s * 4);
		g.fillRect(x - s * 2, y - s / 2, s * 4, s);
	}
	g.globalAlpha = 1;
	if (mark) {
		const s = 62;
		g.drawImage(mark, 168 - s / 2, 440 - s / 2, s, s);
	}
	return c;
}

// The coin door: a dark steel plate, one lit coin slot, a coin-return flap below.
// (Two lit slots side by side read as a pair of eyes. One does not.) 256 x 320 (2x).
export function paintCoinDoor() {
	const c = makeCanvas(256, 320);
	const g = c.getContext('2d');
	g.scale(2, 2);
	const steel = g.createLinearGradient(0, 0, 128, 160);
	steel.addColorStop(0, '#34343f');
	steel.addColorStop(1, '#1b1b22');
	g.fillStyle = steel;
	g.fillRect(0, 0, 128, 160);
	g.strokeStyle = '#50505f';
	g.lineWidth = 4;
	g.strokeRect(4, 4, 120, 152);
	g.fillStyle = '#ff3355';
	g.shadowColor = '#ff3355';
	g.shadowBlur = 14;
	g.fillRect(52, 30, 24, 40);
	g.shadowBlur = 0;
	g.fillStyle = '#1a0610';
	g.fillRect(62, 36, 4, 28);
	g.fillStyle = '#121218';
	g.fillRect(44, 100, 40, 26);
	g.strokeStyle = '#4a4a58';
	g.lineWidth = 2;
	g.strokeRect(44, 100, 40, 26);
	return c;
}

// Soft round spot, white in the middle, clear at the rim: shadows, floor glow, halos.
export function paintRadial(size = 256, inner = 0) {
	const c = makeCanvas(size, size);
	const g = c.getContext('2d');
	const gr = g.createRadialGradient(size / 2, size / 2, inner * size, size / 2, size / 2, size / 2);
	gr.addColorStop(0, 'rgba(255,255,255,1)');
	gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
	gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr;
	g.fillRect(0, 0, size, size);
	return c;
}

// Bulbs round the rim of each turning platform; the texture scrolls so they chase.
export function paintBulbs() {
	const c = makeCanvas(128, 16);
	const g = c.getContext('2d');
	g.scale(2, 2);
	g.fillStyle = '#000';
	g.fillRect(0, 0, 64, 8);
	const gr = g.createRadialGradient(16, 4, 0, 16, 4, 12);
	gr.addColorStop(0, '#ffffff');
	gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
	gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr;
	g.fillRect(0, 0, 32, 8);
	g.fillStyle = 'rgba(255,255,255,0.25)';
	g.fillRect(44, 2, 8, 4);
	return c;
}

// The Portal lockup's drawn area inside lockup-horizontal.svg (viewBox 1411.92 x 400):
// the frame's outer edge to the end of the lettering, with a few units to spare.
const LOCKUP = { vbW: 1411.92, vbH: 400, x: 62, y: 62, w: 1288, h: 276 };

// The neon sign: the Portal lockup exactly as drawn (vector, so it is sharp at any
// size), with a glow laid around it. 2680 px wide (2x).
export function paintNeonSign(logo) {
	const LW = 2200, k = LW / LOCKUP.w, LH = Math.round(LOCKUP.h * k);
	const W = 2680, H = LH + 480;
	const c = makeCanvas(W, H);
	const g = c.getContext('2d');
	const x = (W - LW) / 2, y = (H - LH) / 2;
	// draw the whole SVG, offset so its drawn area lands in the middle (no source rect)
	const draw = () => g.drawImage(logo, x - LOCKUP.x * k, y - LOCKUP.y * k, LOCKUP.vbW * k, LOCKUP.vbH * k);
	g.shadowColor = 'rgba(83,230,255,0.9)';
	g.shadowBlur = 140;
	draw();
	g.shadowBlur = 52;
	draw();
	g.shadowColor = 'rgba(255,204,51,0.55)';
	g.shadowBlur = 20;
	draw();
	g.shadowBlur = 0;
	draw();
	return { canvas: c, logoFrac: LW / W, aspect: LOCKUP.w / LOCKUP.h };
}
