/**
Initialize the real WebGPU device, scene, camera, and letterboxed viewport.
 */
import * as THREE from 'three/webgpu';
import { CAMERA_FAR } from './view.ts';

/**
 * Look up a required page element using the caller's expected element type. The page markup
 * must supply this ID.
 *
 * @template T - Expected DOM element subtype; the markup must satisfy this assertion.
 * @param id - Required element ID
 * @returns The existing DOM element; no runtime null or type check is performed.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`#${CSS.escape(id)}`)!;

/**
 * Create the WebGPU renderer, scene, and camera and mount the letterboxed viewport. Device
 * loss notifies the user and clears input.
 *
 * @param notify - User-facing device-loss notification callback
 * @param neutralize - Callback that clears held player input
 * @returns Initialized graphics objects, adapter information, and a resize callback.
 * @throws {Error} WebGPU or an adapter is unavailable, device/renderer initialization
 * fails, or a real WebGPU backend is not selected.
 */
export async function initializeGraphics(
    notify: (message: string) => void,
    neutralize: () => void,
) {
    if (!navigator.gpu)
        throw new Error(
            'WebGPU is unavailable. Use an up-to-date desktop browser with hardware acceleration.',
        );
    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) throw new Error('No WebGPU adapter is available on this device.');
    const adapterInfo = {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
        isFallbackAdapter: adapter.info.isFallbackAdapter,
    };
    const device = await adapter.requestDevice();
    const renderer = new THREE.WebGPURenderer({ antialias: true, device });

    await renderer.init();
    if (
        !(renderer.backend as unknown as { isWebGPUBackend?: boolean })
            .isWebGPUBackend
    )
        throw new Error('A real WebGPU backend is required.');
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, CAMERA_FAR);

    camera.position.set(0, 1.6, 0);
    $('viewport').append(renderer.domElement);
    renderer.domElement.setAttribute(
        'aria-label',
        'Explore Willowmere wildlife reserve',
    );

    /**
     * Resize and center the renderer canvas and viewfinder together at a fixed 16:9 aspect
     * ratio.
     */
    const resize = () => {
        const w = Math.min(innerWidth, (innerHeight * 16) / 9),
            h = (w * 9) / 16,
            x = (innerWidth - w) / 2,
            y = (innerHeight - h) / 2;

        renderer.setSize(w, h);
        Object.assign(renderer.domElement.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
        });
        Object.assign($('viewfinder').style, {
            inset: 'auto',
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
        });
    };

    resize();

    document.body.dataset.ready = 'webgpu';
    void (async () => {
        const info = await device.lost;

        notify(
            `Graphics device lost: ${info.message}. Reload to rejoin; the server keeps the outing.`,
        );
        neutralize();
    })();

    return { renderer, scene, camera, adapterInfo, resize };
}
