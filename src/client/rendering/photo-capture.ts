/** Render a frozen frame to a bounded JPEG, then restore the live renderer state. */
import * as THREE from "three/webgpu";
import { CAMERA_FAR } from "./view-constants.ts";
import type { PhotoFrame } from "../../shared/shared.ts";
import type { ReserveBlueprint } from "../../shared/world/world.ts";
/**
 * Render a frozen shutter frame to a 640x360 JPEG no larger than 64 KiB. Restores the live
 * scene/render target even on failure and always disposes the temporary target.
 *
 * @param renderer - Initialized WebGPU renderer
 * @param scene - Live scene temporarily set to the photo frame
 * @param frame - Frozen shutter frame
 * @param world - Blueprint belonging to the frame
 * @param apply - Callback applying frozen scene state synchronously
 * @param restore - Callback restoring live scene state synchronously
 * @returns The encoded JPEG blob.
 * @throws {Error} Frame/world IDs differ, rendering or encoding fails, or no attempted JPEG
 * quality fits the byte limit.
 */
export async function capturePhoto(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  frame: PhotoFrame,
  world: ReserveBlueprint,
  apply: () => void,
  restore: () => void,
): Promise<Blob> {
  if (frame.worldId !== world.id) throw Error("Capture world mismatch");
  const target = new THREE.RenderTarget(640, 360, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(
    frame.camera.fov,
    16 / 9,
    0.05,
    CAMERA_FAR,
  );
  cam.position.set(...frame.camera.position);
  cam.rotation.set(frame.camera.pitch, frame.camera.yaw, 0, "YXZ");
  const previous = renderer.getRenderTarget();
  try {
    try {
      apply();
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
    } finally {
      renderer.setRenderTarget(previous);
      restore();
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      640,
      360,
    );
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(
            new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
          ),
          640,
          360,
        ),
        0,
        0,
      );
    for (const quality of [0.85, 0.65, 0.4, 0.2]) {
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", quality),
      );
      if (blob && blob.size <= 65536) return blob;
    }
    throw Error("Photo could not fit the album. Please try again.");
  } finally {
    target.dispose();
  }
}
