// The crew in 3D, for the About page. Loaded only when the crew section comes near the screen,
// after the page is idle (see src/pages/about.astro), never at page load. One character on the
// stage at a time: Idle loops, and every 4 to 6 seconds the special plays once and blends back.
//
// Models: public/crew-3d/models/<name>.glb, built by tools/crew3d/build-models.mjs.
// three.js: self-hosted in ./vendor/three/ (tools/crew3d/build-vendor.mjs); no outside connections.
// The portrait stills are rendered from this same rig (tools/crew3d/stills.html), so the stills
// and the live stage share one camera and one light.
import {
	AnimationMixer,
	CanvasTexture,
	Color,
	DirectionalLight,
	GLTFLoader,
	HemisphereLight,
	LinearSRGBColorSpace,
	LoopOnce,
	LoopRepeat,
	Mesh,
	MeshBasicMaterial,
	MeshoptDecoder,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from './vendor/three/three-crew.min.js?v=1';

/** Bump when a model is rebuilt, so browsers fetch the new file. */
export const VERSION = '1';

/** Each character's special clip (the other clip in the file is Idle). */
export const CREW = {
	dirigent: 'Direct',
	fundi: 'ThumbsUp',
	kalakar: 'Paint',
	custos: 'Alert',
	indaga: 'Eureka',
	portero: 'Portal',
	contador: 'Tally',
};

/** One framing for everyone. The stage and the stills are 4:5; feet sit on y = 0. */
export const FRAME = {
	fov: 30,
	aspect: 4 / 5,
	full: { eye: [0, 1.15, 4.6], target: [0, 0.97, 0] },
	bust: { eye: [0, 1.62, 1.45], target: [0, 1.58, 0] },
};

const KEEP = 2; // models held in memory at once (the current one and the one before)
const MAX_PIXEL_RATIO = 1.5;
const SPECIAL_EVERY = [4, 6]; // seconds of Idle before the special plays again
const FADE_IN = 0.35;
const FADE_OUT = 0.5;
const SWAY = { amount: 0.3, period: 16 }; // a slow turn either way while idle, radians and seconds

const modelsUrl = new URL('./models/', import.meta.url);

// The phone viewer Evrtek approved used three's old light units (r147); these are the same
// lights in r170's physical units (x pi), with the colours taken as linear as they were then.
function linear(hex) {
	return new Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, LinearSRGBColorSpace);
}

function contactShadow() {
	const c = document.createElement('canvas');
	c.width = c.height = 128;
	const g = c.getContext('2d');
	const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0, 'rgba(4, 2, 16, 0.55)');
	grad.addColorStop(0.55, 'rgba(4, 2, 16, 0.22)');
	grad.addColorStop(1, 'rgba(4, 2, 16, 0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, 128, 128);
	const tex = new CanvasTexture(c);
	const mesh = new Mesh(new PlaneGeometry(1.1, 0.7), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
	mesh.rotation.x = -Math.PI / 2;
	mesh.position.y = 0.003;
	mesh.renderOrder = -1;
	return mesh;
}

/** The shared rig: renderer, scene, camera, lights and loader. */
export function createRig(canvas, { preserveDrawingBuffer = false } = {}) {
	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer, powerPreference: 'low-power' });
	renderer.setClearColor(0x000000, 0);
	const scene = new Scene();
	const camera = new PerspectiveCamera(FRAME.fov, FRAME.aspect, 0.05, 60);

	const hemi = new HemisphereLight(0xffffff, 0xffffff, 0.9 * Math.PI);
	hemi.color.copy(linear(0xfff1e0));
	hemi.groundColor.copy(linear(0x2a2350));
	const key = new DirectionalLight(0xffffff, 0.9 * Math.PI);
	key.color.copy(linear(0xffe2c4));
	key.position.set(2, 3, 3);
	const rim = new DirectionalLight(0xffffff, 0.45 * Math.PI);
	rim.color.copy(linear(0x8fdcff));
	rim.position.set(-3, 2, -3);
	scene.add(hemi, key, rim, contactShadow());

	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

	function aim(view = 'full') {
		const v = FRAME[view];
		camera.position.set(...v.eye);
		camera.lookAt(...v.target);
	}
	aim('full');

	/** Fetch one character; resolves with its scene, mixer and two actions (Idle and special). */
	async function load(name) {
		const gltf = await loader.loadAsync(new URL(`${name}.glb?v=${VERSION}`, modelsUrl).href);
		const root = gltf.scene;
		const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
		root.traverse((o) => {
			if (o.isMesh) {
				o.frustumCulled = false; // skinned bounds do not follow the pose; the stage is small anyway
				for (const m of [o.material].flat()) if (m && m.map) m.map.anisotropy = aniso;
			}
		});
		const mixer = new AnimationMixer(root);
		const clip = (n) => gltf.animations.find((a) => a.name === n);
		const idle = mixer.clipAction(clip('Idle'));
		const special = mixer.clipAction(clip(CREW[name]));
		idle.setLoop(LoopRepeat, Infinity);
		special.setLoop(LoopOnce, 1);
		special.clampWhenFinished = true;
		return { name, root, mixer, idle, special };
	}

	return { renderer, scene, camera, aim, load };
}

/** Free a loaded character's GPU memory. */
export function disposeModel(m) {
	m.mixer.stopAllAction();
	m.mixer.uncacheRoot(m.root);
	m.root.removeFromParent();
	m.root.traverse((o) => {
		if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose();
		if (!o.isMesh) return;
		o.geometry.dispose();
		for (const mat of [o.material].flat()) {
			if (!mat) continue;
			for (const k in mat) if (mat[k] && mat[k].isTexture) mat[k].dispose();
			mat.dispose();
		}
	});
}

const rand = ([a, b]) => a + Math.random() * (b - a);

/**
 * Mount the live stage inside `stage` (an element with a 4:5 box). Returns null when WebGL 2 is not
 * available, so the caller keeps the still portrait. Callbacks: onLoading(name), onShow(name), onError(name).
 */
export function mountViewer(stage, { onLoading = () => {}, onShow = () => {}, onError = () => {} } = {}) {
	const canvas = document.createElement('canvas');
	canvas.className = 'crew3d-canvas';
	canvas.setAttribute('aria-hidden', 'true');
	let rig;
	try {
		rig = createRig(canvas);
	} catch {
		return null;
	}
	const { renderer, scene, camera } = rig;
	stage.appendChild(canvas);

	const cache = new Map(); // name -> loaded model, oldest first
	let current = null;
	let wanted = null;
	let loading = null;
	let phase = 'idle';
	let idleFor = 0;
	let nextAt = rand(SPECIAL_EVERY);
	let swayT = 0;

	function resize() {
		const w = stage.clientWidth;
		const h = stage.clientHeight;
		if (!w || !h) return;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
	new ResizeObserver(resize).observe(stage);
	resize();

	function evict() {
		while (cache.size > KEEP) {
			const [name, m] = [...cache].find(([n]) => n !== current?.name);
			cache.delete(name);
			disposeModel(m);
		}
	}

	function onFinished(e) {
		if (!current || e.action !== current.special) return;
		current.idle.reset().play();
		current.special.crossFadeTo(current.idle, FADE_OUT, false);
		phase = 'idle';
		idleFor = 0;
		swayT = 0;
		nextAt = rand(SPECIAL_EVERY);
	}

	function activate(m) {
		if (current && current !== m) {
			current.mixer.removeEventListener('finished', onFinished);
			current.mixer.stopAllAction();
			current.root.removeFromParent();
		}
		current = m;
		cache.delete(m.name);
		cache.set(m.name, m); // most recently used last
		m.root.rotation.y = 0;
		m.special.stop();
		m.idle.reset().play();
		m.mixer.addEventListener('finished', onFinished);
		m.mixer.update(0);
		scene.add(m.root);
		phase = 'idle';
		idleFor = 0;
		swayT = 0;
		nextAt = rand(SPECIAL_EVERY);
		renderer.render(scene, camera);
		onShow(m.name);
	}

	async function show(name) {
		if (!CREW[name]) return;
		wanted = name;
		if (current && current.name === name) return onShow(name);
		if (cache.has(name)) return activate(cache.get(name));
		if (loading) return onLoading(name); // one fetch at a time; the latest tap wins when it ends
		loading = name;
		onLoading(name);
		try {
			const m = await rig.load(name);
			cache.set(name, m);
			if (wanted === name) activate(m);
			evict();
		} catch (err) {
			if (wanted === name) onError(name, err);
		} finally {
			loading = null;
		}
		if (wanted && wanted !== current?.name && wanted !== name) show(wanted);
	}

	// Draw only while the stage is on screen and the tab is visible.
	let onScreen = false;
	let raf = 0;
	let last = 0;
	function frame(now) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min((now - last) / 1000, 0.1);
		last = now;
		if (!current) return;
		const m = current;
		let yawTo = 0;
		if (phase === 'idle') {
			idleFor += dt;
			swayT += dt;
			yawTo = SWAY.amount * Math.sin((swayT / SWAY.period) * Math.PI * 2);
			if (idleFor >= nextAt) {
				phase = 'special';
				m.special.reset().play();
				m.idle.crossFadeTo(m.special, FADE_IN, false);
			}
		}
		m.root.rotation.y += (yawTo - m.root.rotation.y) * (1 - Math.exp(-dt * 2.5));
		m.mixer.update(dt);
		renderer.render(scene, camera);
	}
	function run() {
		const go = onScreen && !document.hidden;
		if (go && !raf) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		} else if (!go && raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	}
	new IntersectionObserver((entries) => {
		onScreen = entries[entries.length - 1].isIntersecting;
		run();
	}).observe(stage);
	document.addEventListener('visibilitychange', run);

	return {
		show,
		/** Read-only snapshot, for checks: who is on stage, what is playing, what is held in memory. */
		get state() {
			const { geometries, textures } = renderer.info.memory;
			return { name: current ? current.name : null, phase, running: !!raf, loaded: [...cache.keys()], geometries, textures };
		},
	};
}
