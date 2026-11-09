// Arcade landing preview: the 3D room. three.js r170, vendored beside this file.
// Low-poly on purpose: about twenty meshes a cabinet, no shadow maps (soft blob
// shadows instead), capped pixel ratio, and each cabinet's art loads only when it
// comes near the front.
import * as THREE from './vendor/three.module.min.js?v=r170';
import { curve, layoutFor, wrapD, loadImage, paintWindowView, paintCarpet, paintSideArt, paintCoinDoor, paintRadial, paintBulbs, paintChromeSign } from './shared.js?v=0.6.0';

const CW = 0.64; // cabinet width (m)
const PT = 0.03; // side panel thickness
const BASE_Y = 0.07; // turntable height
// Side profile of a classic upright, (z, y) in metres, front at +z.
const PROFILE = [[-0.4, 0], [0.33, 0], [0.33, 0.88], [0.46, 0.92], [0.46, 1.0], [0.27, 1.07], [0.16, 1.5], [0.32, 1.55], [0.32, 1.8], [-0.4, 1.8]];
const WALL_Z = -8;
const WIN = { x0: -4.6, x1: 4.6, y0: 0.75, y1: 3.85 };

const SCREEN_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_FS = `
uniform sampler2D map; uniform float hasMap; uniform float texAspect; uniform float scrAspect;
uniform float time; uniform float seed; uniform float bright; uniform vec3 tint;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 c = vUv - 0.5;
  vec2 uv = vUv + c * dot(c, c) * 0.12;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 col;
  if (hasMap > 0.5) {
    vec2 t = uv;
    float pan = 0.5 + 0.5 * sin(time * 0.11 + seed);
    if (texAspect > scrAspect) { float s = scrAspect / texAspect; t.x = (1.0 - s) * pan + uv.x * s; }
    else { float s = texAspect / scrAspect; t.y = (1.0 - s) * pan + uv.y * s; }
    col = texture2D(map, t).rgb;
  } else {
    float n = hash(floor(uv * vec2(140.0, 100.0)) + floor(time * 20.0));
    col = mix(vec3(0.02), tint * 0.45, n * 0.7);
  }
  col *= 0.86 + 0.14 * sin(uv.y * 6.2832 * 110.0);
  float vig = smoothstep(0.85, 0.3, length(c * vec2(1.0, 1.15)));
  col *= mix(0.5, 1.0, vig);
  col *= bright * (0.985 + 0.015 * sin(time * 47.0 + seed));
  col += tint * 0.025;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function createRoom3D({ canvas, games, brand, onFirstFrame }) {
	const N = games.length;
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	// Round 2: full device resolution on desktop (up to 3x), 2x on phones; the slow-frame
	// watch below steps it back down if a device cannot keep up.
	const coarse = matchMedia('(pointer: coarse)').matches;
	const dprCap = coarse ? 2 : 3;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
	const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0b0920);
	scene.fog = new THREE.Fog(0x110c28, 10, 30);
	const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);

	const canvasTex = (c, srgb = true) => {
		const t = new THREE.CanvasTexture(c);
		if (srgb) t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = aniso;
		return t;
	};

	/* ------------------------------------------------------------ the room */
	const carpetTex = canvasTex(paintCarpet(1024));
	carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
	carpetTex.repeat.set(40 / 1.9, 40 / 1.9);
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(40, 40),
		new THREE.MeshLambertMaterial({ color: 0xa8a4c4, map: carpetTex, emissive: 0xffffff, emissiveMap: carpetTex, emissiveIntensity: 0.03 }),
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.z = -4;
	scene.add(floor);

	const wallMat = new THREE.MeshLambertMaterial({ color: 0x1b1536 });
	const wallPiece = (x0, x1, y0, y1) => {
		const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), wallMat);
		m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z);
		scene.add(m);
	};
	wallPiece(-16, WIN.x0, 0, 7);
	wallPiece(WIN.x1, 16, 0, 7);
	wallPiece(WIN.x0, WIN.x1, WIN.y1, 7);
	wallPiece(WIN.x0, WIN.x1, 0, WIN.y0);
	const wains = new THREE.Mesh(new THREE.BoxGeometry(32, 0.7, 0.05), new THREE.MeshLambertMaterial({ color: 0x110c22 }));
	wains.position.set(0, 0.35, WALL_Z + 0.03);
	scene.add(wains);
	const rail = new THREE.Mesh(new THREE.BoxGeometry(32, 0.05, 0.08), new THREE.MeshLambertMaterial({ color: 0x3c2c58 }));
	rail.position.set(0, 0.72, WALL_Z + 0.04);
	scene.add(rail);
	const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0x0b0918 }));
	ceiling.rotation.x = Math.PI / 2;
	ceiling.position.set(0, 5.2, -4);
	scene.add(ceiling);

	// the window and its view
	const winW = WIN.x1 - WIN.x0, winH = WIN.y1 - WIN.y0;
	const winView = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ map: canvasTex(paintWindowView({ width: 3072 })), fog: false }));
	winView.position.set(0, (WIN.y0 + WIN.y1) / 2, WALL_Z - 0.2);
	scene.add(winView);
	const frameMat = new THREE.MeshLambertMaterial({ color: 0x0e0b1c });
	const frameBox = (w, h, x, y) => {
		const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.26), frameMat);
		m.position.set(x, y, WALL_Z - 0.08);
		scene.add(m);
	};
	frameBox(winW + 0.24, 0.12, 0, WIN.y1 + 0.06);
	frameBox(winW + 0.24, 0.12, 0, WIN.y0 - 0.06);
	frameBox(0.12, winH, WIN.x0 - 0.06, (WIN.y0 + WIN.y1) / 2);
	frameBox(0.12, winH, WIN.x1 + 0.06, (WIN.y0 + WIN.y1) / 2);
	const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.5, 0.06, 0.34), new THREE.MeshLambertMaterial({ color: 0x2a1f40 }));
	sill.position.set(0, WIN.y0 - 0.12, WALL_Z + 0.12);
	scene.add(sill);

	// the neon sign hangs in the top of the window
	let sign = null;
	loadImage(brand.lockup).then((logo) => {
		const { canvas: sc, logoFrac, aspect } = paintChromeSign(logo);
		const logoW = 2.7;
		const w = logoW / logoFrac, h = (w * sc.height) / sc.width;
		sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(sc), transparent: true, depthWrite: false, fog: false }));
		sign.position.set(0, WIN.y1 - 0.62, WALL_Z - 0.02);
		sign.userData.baseW = logoW;
		sign.userData.aspect = aspect;
		scene.add(sign);
		fitSign();
	}).catch(() => {});

	// The other machines in the room: whole dim cabinets (body, lit marquee, glowing
	// screen, a shadow on the carpet) along the back wall and down both sides, so the
	// room's edges read as more arcade rather than as floating tiles. Four draw calls.
	const shape = new THREE.Shape(PROFILE.map(([z, y]) => new THREE.Vector2(z, y)));
	const bgGeo = new THREE.ExtrudeGeometry(shape, { depth: CW, bevelEnabled: false });
	bgGeo.rotateY(-Math.PI / 2);
	bgGeo.translate(CW / 2, 0, 0);
	const bgSpots = [];
	for (let x = -12.6; x <= -5.4; x += 0.78) bgSpots.push([x, WALL_Z + 0.5, 0]);
	for (let x = 5.4; x <= 12.6; x += 0.78) bgSpots.push([x, WALL_Z + 0.5, 0]);
	for (let i = 0; i < 6; i++) { bgSpots.push([-8.2 - i * 0.12, -0.6 - i * 0.82, 1.2]); bgSpots.push([8.2 + i * 0.12, -0.6 - i * 0.82, -1.2]); }
	const n = bgSpots.length;
	const bgCabs = new THREE.InstancedMesh(bgGeo, new THREE.MeshLambertMaterial({ color: 0x3b3368 }), n);
	const bgScreens = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.37), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
	const bgMarquees = new THREE.InstancedMesh(new THREE.PlaneGeometry(CW - 2 * PT, 0.245), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
	const bgShadowGeo = new THREE.PlaneGeometry(1.7, 1.7);
	bgShadowGeo.rotateX(-Math.PI / 2);
	const bgShadows = new THREE.InstancedMesh(bgShadowGeo, new THREE.MeshBasicMaterial({ map: null, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }), n);
	const dummy = new THREE.Object3D(), local = new THREE.Object3D(), mloc = new THREE.Object3D();
	local.position.set(0, 1.2857, 0.2199);
	local.rotation.x = -0.2502;
	local.updateMatrix();
	mloc.position.set(0, 1.675, 0.3235);
	mloc.updateMatrix();
	const bgCols = ['#53e6ff', '#ffcc33', '#ff4fa3', '#8a5cff', '#3dff7a', '#ff7a3d'].map((c) => new THREE.Color(c));
	const rr = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
	bgSpots.forEach(([x, z, ry], i) => {
		dummy.position.set(x, 0, z);
		dummy.rotation.set(0, ry, 0);
		dummy.updateMatrix();
		bgCabs.setMatrixAt(i, dummy.matrix);
		bgScreens.setMatrixAt(i, dummy.matrix.clone().multiply(local.matrix));
		bgMarquees.setMatrixAt(i, dummy.matrix.clone().multiply(mloc.matrix));
		dummy.position.y = 0.004;
		dummy.updateMatrix();
		bgShadows.setMatrixAt(i, dummy.matrix);
		const col = bgCols[(rr() * bgCols.length) | 0];
		bgScreens.setColorAt(i, col.clone().multiplyScalar(0.17 + rr() * 0.13));
		bgMarquees.setColorAt(i, col.clone().lerp(new THREE.Color(0xffffff), 0.2).multiplyScalar(0.27));
	});
	scene.add(bgShadows, bgCabs, bgScreens, bgMarquees);

	// light: a cool fill from above, a warm key from the front, the sunrise behind,
	// and one coloured lamp that follows whichever game is in front
	scene.add(new THREE.HemisphereLight(0x7d6cff, 0x2a1030, 1.15));
	const key = new THREE.DirectionalLight(0xffe6d0, 1.5);
	key.position.set(3, 6, 7);
	scene.add(key);
	const rim = new THREE.DirectionalLight(0xff9a50, 1.8);
	rim.position.set(0, 3, -9);
	scene.add(rim);
	const focusLamp = new THREE.PointLight(0xffffff, 2.6, 5, 2);
	focusLamp.position.set(0, 1.3, 1.15);
	scene.add(focusLamp);

	/* ---------------------------------------------------------- cabinets */
	const panelGeo = new THREE.ExtrudeGeometry(shape, { depth: PT, bevelEnabled: false });
	panelGeo.rotateY(-Math.PI / 2);
	const bodyDepth = CW - 2 * PT - 0.004;
	const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: bodyDepth, bevelEnabled: false });
	bodyGeo.rotateY(-Math.PI / 2);
	bodyGeo.translate(bodyDepth / 2, 0, 0);
	const innerW = CW - 2 * PT;
	const marqueeGeo = new THREE.PlaneGeometry(innerW, 0.245);
	const scrW = 0.5, scrH = 0.37;
	const screenGeo = new THREE.PlaneGeometry(scrW, scrH);
	const bezelGeo = new THREE.PlaneGeometry(innerW - 0.01, 0.43);
	const deckGeo = new THREE.PlaneGeometry(innerW, 0.2);
	deckGeo.rotateX(-Math.PI / 2);
	const stickBaseGeo = new THREE.CylinderGeometry(0.03, 0.034, 0.012, 16);
	const shaftGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8);
	const ballGeo = new THREE.SphereGeometry(0.022, 12, 8);
	const btnGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.014, 16);
	const coinGeo = new THREE.PlaneGeometry(0.2, 0.25);
	const puckGeo = new THREE.CylinderGeometry(0.62, 0.66, BASE_Y, 40);
	const rimGeo = new THREE.CylinderGeometry(0.665, 0.665, 0.03, 48, 1, true);
	const spotGeo = new THREE.PlaneGeometry(1, 1);
	spotGeo.rotateX(-Math.PI / 2);
	const haloGeo = new THREE.PlaneGeometry(2.6, 3.0);

	const radialTex = canvasTex(paintRadial(256), false);
	bgShadows.material.map = radialTex;
	bgShadows.material.needsUpdate = true;
	const bulbTex = canvasTex(paintBulbs());
	bulbTex.wrapS = THREE.RepeatWrapping;
	bulbTex.repeat.set(28, 1);
	const coinMat = new THREE.MeshBasicMaterial({ map: canvasTex(paintCoinDoor()) });
	const shaftMat = new THREE.MeshLambertMaterial({ color: 0x222228 });
	const ballMat = new THREE.MeshLambertMaterial({ color: 0xe02040, emissive: 0x400010 });
	const puckMat = new THREE.MeshLambertMaterial({ color: 0x1c1532 });
	const bezelMat = new THREE.MeshLambertMaterial({ color: 0x060509 });
	const shadowMat = new THREE.MeshBasicMaterial({ map: radialTex, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false });
	const loader = new THREE.TextureLoader();

	let markImg = null;
	const cabs = games.map((g, i) => {
		const trim = new THREE.Color(g.trim), trim2 = new THREE.Color(g.trim2), body = new THREE.Color(g.body);
		const grp = new THREE.Group();
		const turn = new THREE.Group();
		const cab = new THREE.Group();
		grp.add(turn);
		turn.add(cab);
		cab.position.set(0, BASE_Y, -0.03);

		const sideCanvas = paintSideArt({ body: g.body, trim: g.trim, trim2: g.trim2, mark: markImg });
		const sideTex = canvasTex(sideCanvas);
		sideTex.repeat.set(1 / 0.86, 1 / 1.8);
		sideTex.offset.set(0.4 / 0.86, 0);
		const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
		const moldMat = new THREE.MeshBasicMaterial({ color: trim });
		const bodyMat = new THREE.MeshLambertMaterial({ color: body });
		const tag = (m, part) => { m.userData = { index: i, part }; return m; };
		const left = tag(new THREE.Mesh(panelGeo, [sideMat, moldMat]), 'body');
		left.position.x = -CW / 2 + PT;
		const right = tag(new THREE.Mesh(panelGeo, [sideMat, moldMat]), 'body');
		right.position.x = CW / 2;
		const bodyMesh = tag(new THREE.Mesh(bodyGeo, bodyMat), 'body');

		const marqueeMat = new THREE.MeshBasicMaterial({ color: trim.clone().multiplyScalar(0.35) });
		const marquee = tag(new THREE.Mesh(marqueeGeo, marqueeMat), 'screen');
		marquee.position.set(0, 1.675, 0.3225);

		const bezel = tag(new THREE.Mesh(bezelGeo, bezelMat), 'screen');
		bezel.position.set(0, 1.2857, 0.2179);
		bezel.rotation.x = -0.2502;
		const screenU = {
			map: { value: null }, hasMap: { value: 0 }, texAspect: { value: 1 }, scrAspect: { value: scrW / scrH },
			time: { value: 0 }, seed: { value: i * 1.7 }, bright: { value: 1 }, tint: { value: trim.clone() },
		};
		const screen = tag(new THREE.Mesh(screenGeo, new THREE.ShaderMaterial({ uniforms: screenU, vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS })), 'screen');
		screen.position.set(0, 1.2857 + 0.248 * 0.002, 0.2179 + 0.969 * 0.002);
		screen.rotation.x = -0.2502;

		const deck = new THREE.Group();
		deck.position.set(0, 1.035 + 0.938 * 0.002, 0.365 + 0.346 * 0.002);
		deck.rotation.x = 0.353;
		const deckPanel = new THREE.Mesh(deckGeo, new THREE.MeshLambertMaterial({ color: body.clone().lerp(trim, 0.28) }));
		const stickBase = new THREE.Mesh(stickBaseGeo, shaftMat);
		stickBase.position.set(-0.13, 0.006, 0);
		const shaft = new THREE.Mesh(shaftGeo, shaftMat);
		shaft.position.set(-0.13, 0.04, 0);
		const ball = new THREE.Mesh(ballGeo, ballMat);
		ball.position.set(-0.13, 0.078, 0);
		deck.add(deckPanel, stickBase, shaft, ball);
		[[0.0, -0.01, trim], [0.075, -0.028, trim2], [0.15, -0.01, trim], [0.22, 0.03, new THREE.Color(0xeef0fa)]].forEach(([x, z, c]) => {
			const b = new THREE.Mesh(btnGeo, new THREE.MeshLambertMaterial({ color: c, emissive: c.clone().multiplyScalar(0.35) }));
			b.position.set(x, 0.007, z);
			if (x > 0.2) b.scale.setScalar(0.65);
			deck.add(b);
		});

		const coin = new THREE.Mesh(coinGeo, coinMat);
		coin.position.set(0, 0.52, 0.3315);
		cab.add(left, right, bodyMesh, marquee, bezel, screen, deck, coin);

		const puck = tag(new THREE.Mesh(puckGeo, puckMat), 'body');
		puck.position.y = BASE_Y / 2;
		const rimMesh = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: trim, map: bulbTex }));
		rimMesh.position.y = BASE_Y - 0.018;
		turn.add(puck, rimMesh);

		const shadow = new THREE.Mesh(spotGeo, shadowMat);
		shadow.scale.set(1.9, 1, 1.9);
		shadow.position.y = 0.003;
		const glow = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ map: radialTex, color: trim, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }));
		glow.scale.set(3.4, 1, 2.4);
		glow.position.set(0, 0.006, 0.9);
		const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ map: radialTex, color: trim, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.2 }));
		halo.position.set(0, 1.15, -0.75);
		grp.add(shadow, glow, halo);
		scene.add(grp);

		return { i, g, grp, turn, screenU, marqueeMat, sideTex, sideCanvas, glow, halo, trim, pick: [left, right, bodyMesh, marquee, bezel, screen, puck], loaded: false };
	});

	// the maker's badge arrives a moment later; repaint the sides when it does
	loadImage(brand.markSvg).then((img) => {
		markImg = img;
		cabs.forEach((c) => {
			const fresh = paintSideArt({ body: c.g.body, trim: c.g.trim, trim2: c.g.trim2, mark: img });
			c.sideCanvas.getContext('2d').drawImage(fresh, 0, 0);
			c.sideTex.needsUpdate = true;
		});
	}).catch(() => {});

	function ensureArt(c) {
		if (c.loaded) return;
		c.loaded = true;
		loader.load(c.g.marquee, (tex) => {
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.anisotropy = aniso;
			c.marqueeMat.map = tex;
			c.marqueeMat.color.set(0xffffff);
			c.marqueeMat.needsUpdate = true;
		});
		loader.load(c.g.attract, (tex) => {
			tex.anisotropy = aniso;
			c.screenU.map.value = tex;
			c.screenU.texAspect.value = tex.image.width / tex.image.height;
			c.screenU.hasMap.value = 1;
		});
	}

	/* ------------------------------------------------------------ framing */
	let L = layoutFor(1, 1), dist = 6, halfW = 2, pxPerCab = 300, view = { W: 1, H: 1 }, signBand = { y: 0, h: 100 }, focal = 1000;
	const signPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(WALL_Z - 0.02));
	const signHit = new THREE.Vector3();
	// The sign gets the top band of the free space above the cabinets: find where that band
	// lands on the back wall, then size the sign to fill it, whatever the screen.
	function fitSign() {
		if (!sign) return;
		// no room for the sign when the cabinet is framed close (phones)
		sign.visible = signBand.h >= 40;
		if (!sign.visible) return;
		camera.updateMatrixWorld();
		const ndcY = 1 - (2 * (signBand.y + signBand.h * 0.5)) / view.H;
		raycaster.setFromCamera(ndc.set(0, ndcY), camera);
		if (!raycaster.ray.intersectPlane(signPlane, signHit)) return;
		sign.position.set(0, signHit.y, WALL_Z - 0.02);
		let wpx = signBand.h * 0.68 * sign.userData.aspect;
		wpx = Math.min(wpx, view.W * 0.72, 420);
		const worldW = (wpx * camera.position.distanceTo(signHit)) / focal;
		sign.scale.setScalar(worldW / sign.userData.baseW);
	}
	// Fit the focused cabinet's framed slice (L.frame) into the free space: by height or
	// by width, whichever is tighter, so every screen shape works. cx is the free space's
	// horizontal centre (the title card sits to the side on a landscape phone).
	function resize(W, H, top, bottom, cx = W / 2, freeW = W) {
		view = { W, H };
		L = layoutFor(W, H);
		camera.fov = L.fov;
		camera.aspect = W / H;
		const f = H / 2 / Math.tan(THREE.MathUtils.degToRad(L.fov / 2));
		focal = f;
		const freeH = Math.max(140, bottom - top);
		const band = freeH * L.band;
		signBand = { y: top, h: band };
		const cTop = top + band;
		const sliceH = L.frame[1] - L.frame[0];
		dist = Math.max((sliceH * f) / (L.fitH * (bottom - cTop)), (CW * 1.03 * f) / (L.fitW * freeW));
		const lookY = (L.frame[0] + L.frame[1]) / 2;
		camera.position.set(0, lookY + dist * Math.tan(THREE.MathUtils.degToRad(L.pitch)), dist);
		camera.lookAt(0, lookY, 0);
		camera.setViewOffset(W, H, W / 2 - cx, H / 2 - (cTop + bottom) / 2, W, H);
		camera.updateProjectionMatrix();
		halfW = ((W / 2) * dist) / f;
		pxPerCab = L.X[1] * (W / 2);
		renderer.setSize(W, H, false);
		fitSign();
	}

	/* -------------------------------------------------------------- frame */
	const lampCol = new THREE.Color();
	let frames = 0, slow = 0, first = true;
	// ctx.d(i): where cabinet i stands relative to the front (in cabinets), or null when the
	// active filter has taken it out of the ring. Leaving cabinets shrink away where they
	// stood; arriving ones grow in. ctx.lamp: the two games either side of the front.
	function frame(ctx, time, dt) {
		bulbTex.offset.x = (time * 0.6) % 1;
		for (const c of cabs) {
			const d = ctx.d(c.i);
			if (c.appear === undefined) c.appear = d === null ? 0 : 1;
			c.appear = d === null ? Math.max(0, c.appear - dt / 0.3) : Math.min(1, c.appear + dt / 0.35);
			if (d !== null) c.lastD = d;
			const dd = d === null ? c.lastD ?? 99 : d;
			const a = Math.abs(dd), s = Math.sign(dd);
			const vis = a < L.show && c.appear > 0.01;
			c.grp.visible = vis;
			if (!vis) continue;
			const z = curve(L.Z, a, false);
			const xs = curve(L.X, a, true) * halfW;
			c.grp.position.set((s * xs * (dist - z)) / dist, 0, z);
			c.grp.rotation.y = s * curve(L.R, a, true);
			const grow = 1 - Math.pow(1 - c.appear, 3);
			c.grp.scale.setScalar(curve(L.S, a, false) * grow);
			const w = Math.max(0, 1 - a);
			c.turn.rotation.y = w * 0.17 * Math.sin(time * 0.42 + 0.3);
			c.screenU.time.value = time;
			c.screenU.bright.value = 0.55 + 0.45 * w;
			c.glow.material.opacity = 0.1 + 0.5 * w;
			c.halo.material.opacity = 0.04 + 0.26 * w;
			if (d !== null && a <= L.range + 0.6) ensureArt(c);
		}
		lampCol.copy(cabs[ctx.lamp.a].trim).lerp(cabs[ctx.lamp.b].trim, ctx.lamp.t);
		focusLamp.color.copy(lampCol);
		if (sign) sign.material.opacity = time % 9 > 8.75 && Math.sin(time * 80) > 0 ? 0.55 : 1;
		renderer.render(scene, camera);
		if (first) { first = false; onFirstFrame && onFirstFrame(); }
		// A device that cannot keep up gets fewer pixels: watched in windows of 120 frames
		// (after a 30-frame settle), stepping down by half a pixel ratio until it copes or
		// reaches 1. Stops watching after eight windows.
		if (watchWindows < 8) {
			frames++;
			if (frames > 30) {
				if (dt > 0.026) slow++;
				if (frames === 150) {
					const dpr = renderer.getPixelRatio();
					if (slow > 48 && dpr > 1) {
						renderer.setPixelRatio(Math.max(1, Math.round((dpr - 0.5) * 2) / 2));
						resize(view.W, view.H, lastTop, lastBottom, lastCx, lastFreeW);
					} else watchWindows = 7;
					frames = 30;
					slow = 0;
					watchWindows++;
				}
			}
		}
	}
	let watchWindows = 0;
	let lastTop = 0, lastBottom = 1;
	let lastCx, lastFreeW;
	function resizeTracked(W, H, top, bottom, cx, freeW) { lastTop = top; lastBottom = bottom; lastCx = cx; lastFreeW = freeW; resize(W, H, top, bottom, cx, freeW); }
	// the focused screen's on-page rectangle (test hook: the arrows must not cover it)
	function screenRect(i) {
		const c = cabs[i];
		if (!c.grp.visible) return null;
		const m = c.pick[5];
		m.updateMatrixWorld();
		const r = canvas.getBoundingClientRect();
		let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
		const pa = m.geometry.attributes.position;
		for (let k = 0; k < pa.count; k++) {
			tmp.fromBufferAttribute(pa, k).applyMatrix4(m.matrixWorld).project(camera);
			const x = r.left + ((tmp.x + 1) / 2) * r.width, y = r.top + ((1 - tmp.y) / 2) * r.height;
			x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
		}
		return { left: x0, top: y0, right: x1, bottom: y1 };
	}

	// after the first look, fetch the next ring out so it is ready before it is needed
	setTimeout(() => cabs.forEach((c) => { const d = lastCtx && lastCtx.d(c.i); if (d !== null && d !== undefined && Math.abs(d) <= L.range + 1.6) ensureArt(c); }), 1800);
	let lastCtx = null;

	const raycaster = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	function pick(clientX, clientY) {
		const r = canvas.getBoundingClientRect();
		ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
		raycaster.setFromCamera(ndc, camera);
		const objs = [];
		cabs.forEach((c) => { if (c.grp.visible) objs.push(...c.pick); });
		const hit = raycaster.intersectObjects(objs, false)[0];
		return hit ? { index: hit.object.userData.index, part: hit.object.userData.part } : null;
	}

	const tmp = new THREE.Vector3();
	function pointOf(i) {
		const c = cabs[i];
		if (!c.grp.visible) return null;
		c.pick[5].getWorldPosition(tmp).project(camera);
		const r = canvas.getBoundingClientRect();
		return { x: r.left + ((tmp.x + 1) / 2) * r.width, y: r.top + ((1 - tmp.y) / 2) * r.height };
	}

	return {
		frame: (ctx, time, dt) => { lastCtx = ctx; frame(ctx, time, dt); },
		resize: resizeTracked,
		screenRect,
		pick,
		pointOf,
		pxPerCab: () => pxPerCab,
		info: () => ({ dpr: renderer.getPixelRatio(), layout: L.name, sign: sign && { s: +sign.scale.x.toFixed(3), y: +sign.position.y.toFixed(2), band: signBand, focal: Math.round(focal), cam: camera.position.toArray().map((v) => +v.toFixed(2)) }, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, loaded: cabs.filter((c) => c.loaded).map((c) => c.g.id) }),
	};
}
