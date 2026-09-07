/** Shared successful model loads, with transient failures evicted for retry. */
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const assetLoads = new Map<string, ReturnType<GLTFLoader["loadAsync"]>>();
/**
 * Share in-flight and successful model loads by asset name. Evict a failed promise so a
 * later call can retry; successful scene resources remain shared.
 *
 * @param name - Model basename under /models, without the extension
 * @param loader - Loader used only when the name is not cached
 * @returns The cached GLTF load promise.
 * @throws {Error} The underlying model request or GLTF parsing fails.
 */
export function loadAsset(name: string, loader: GLTFLoader) {
  let promise = assetLoads.get(name);
  if (!promise) {
    promise = loader.loadAsync(`/models/${name}.glb`).catch((error) => {
      if (assetLoads.get(name) === promise) assetLoads.delete(name);
      throw error;
    });
    assetLoads.set(name, promise);
  }
  return promise;
}
