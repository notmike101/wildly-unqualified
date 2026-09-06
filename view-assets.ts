/** Shared successful model loads, with transient failures evicted for retry. */
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const assetLoads = new Map<string, ReturnType<GLTFLoader["loadAsync"]>>();
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
