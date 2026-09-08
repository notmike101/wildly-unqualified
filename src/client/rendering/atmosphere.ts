/**
Shared-tick atmosphere; lighting never participates in simulation or photo scoring.
 */
import * as THREE from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { color, mix, normalize, positionWorld, uniform, vec4 } from 'three/tsl';
import type { Vec3 } from '../../shared/shared.ts';

/**
 * Add a readable day/night sky and one shadow light to the forest.
 *
 * @param scene - Scene owning the atmospheric fog
 * @param root - Forest group receiving sky and lights
 * @returns Tick update, shadow centering, and owned-resource disposal.
 */
export function addAtmosphere(scene: THREE.Scene, root: THREE.Group) {
    const fog = new THREE.Fog(0x94_AF_B0, 72, 225);

    scene.fog = fog;
    const sky = new SkyMesh();

    sky.name = 'ForestSky';
    sky.material.fog = false;
    sky.scale.setScalar(10_000);
    sky.turbidity.value = 4;
    sky.rayleigh.value = 1.4;
    sky.mieCoefficient.value = 0.004;
    sky.mieDirectionalG.value = 0.78;
    sky.cloudCoverage.value = 0.56;
    sky.cloudDensity.value = 0.65;
    sky.cloudScale.value = 0.0014;
    sky.cloudSpeed.value = 0;

    const daylight = uniform(1);
    const direction = normalize(positionWorld);
    const moonDirection = uniform(new THREE.Vector3(-0.45, 0.35, 0.4).normalize());
    const moon = direction.dot(moonDirection).smoothstep(0.9995, 0.9997);
    const nightSky = mix(color(0x51_69_86), color(0x16_24_49), direction.y.clamp(0, 1));
    const moonlitSky = mix(nightSky, color(0xEE_F3_FF), moon);

    sky.material.colorNode = mix(
        vec4(moonlitSky, 1),

        // SkyMesh returns vec4; NodeMaterial's declaration also permits other widths.

        sky.material.colorNode as ReturnType<typeof vec4>,
        daylight,
    );

    const ambient = new THREE.HemisphereLight(0xC4_DC_E3, 0x43_54_3A, 2);
    const sun = new THREE.DirectionalLight(0xFF_ED_CF, 3.1);
    const lightDirection = new THREE.Vector3();
    const daySun = new THREE.Color(0xFF_ED_CF), nightSun = new THREE.Color(0xB5_CE_FF);
    const warmSun = new THREE.Color(0xFF_B0_72);
    const dayAmbient = new THREE.Color(0xC4_DC_E3), nightAmbient = new THREE.Color(0xA6_BD_E5);
    const dayGround = new THREE.Color(0x43_54_3A), nightGround = new THREE.Color(0x50_60_70);
    const dayFog = fog.color.clone(), nightFog = new THREE.Color(0x51_69_86);
    const warmFog = new THREE.Color(0xB5_91_82);

    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, {
        left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 250,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.08;
    root.add(sky, ambient, sun, sun.target);

    /**
    Move the light after either its direction or its shadow center changes.
     */
    function positionLight() {
        sun.position.copy(lightDirection).multiplyScalar(105).add(sun.target.position);
        sun.updateMatrixWorld();
    }

    /**
     * Sample the saved 60 Hz clock without accumulating local elapsed time.
     *
     * @param tick - Authoritative live or frozen-photo tick
     */
    function update(tick: number) {
        const minute = (tick / 3600) % 24;
        let transition = 1;

        if (minute >= 21) transition = (minute - 21) / 3;
        else if (minute >= 15) transition = 0;
        else if (minute >= 12) transition = (15 - minute) / 3;
        const day = transition * transition * (3 - 2 * transition);
        const warmth = 4 * day * (1 - day);

        daylight.value = day;
        sky.sunPosition.value.set(-0.45, -0.18 + 0.93 * day * day, 0.4).normalize();
        lightDirection.set(-0.45, 0.35 + 0.4 * day, 0.4).normalize();
        sun.color.copy(nightSun).lerp(daySun, day).lerp(warmSun, warmth * 0.8);
        sun.intensity = 1.2 + 1.9 * day;
        ambient.color.copy(nightAmbient).lerp(dayAmbient, day);
        ambient.groundColor.copy(nightGround).lerp(dayGround, day);
        ambient.intensity = 1.6 + 0.4 * day;
        fog.color.copy(nightFog).lerp(dayFog, day).lerp(warmFog, warmth * 0.65);
        positionLight();
    }
    update(0);

    return {
        update,

        /**
         * Center the shadow region on the live camera or frozen photograph.
         *
         * @param point - Camera world position
         */
        centerShadows(point: Vec3) {
            sun.target.position.set(...point);
            sun.target.updateMatrixWorld();
            positionLight();
        },

        /**
        Release the sky and shadow resources owned by this atmosphere.
         */
        dispose() {
            sky.geometry.dispose();
            sky.material.dispose();
            sun.shadow.dispose();
        },
    };
}
