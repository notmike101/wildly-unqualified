import * as THREE from 'three/webgpu';
import {createView,capturePhoto,CAMERA_FAR} from '/view.ts';
import {findPart} from '/forest-view.ts';
import {subjectPoints} from '/level.ts';
import {propPoint} from '/shared.ts';
const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('Real WebGPU adapter unavailable');
const device=await adapter.requestDevice(),renderer=new THREE.WebGPURenderer({antialias:true,device});await renderer.init();
if(!renderer.backend.isWebGPUBackend)throw Error('Not WebGPU');renderer.setPixelRatio(1);renderer.setSize(960,540);renderer.shadowMap.enabled=true;document.body.append(renderer.domElement);
let scene,view,worldHash;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
window.renderCase=async data=>{
 const {world,frame,snapshot,subjectIds}=data,hash=await digest(new TextEncoder().encode(JSON.stringify(world)));
 if(worldHash!==hash){view?.dispose();scene=new THREE.Scene();view=await createView(scene,world);worldHash=hash;if(view.errors.length)throw Error(view.errors.join('; '));}
 const frozen={...snapshot,tick:frame.tick,players:frame.players,animals:frame.animals,tin:frame.tin,worldId:frame.worldId,props:frame.props,route:frame.route,spills:frame.spills,hats:frame.hats};
 const cam=new THREE.PerspectiveCamera(frame.camera.fov,16/9,.05,CAMERA_FAR);cam.position.set(...frame.camera.position);cam.rotation.set(frame.camera.pitch,frame.camera.yaw,0,'YXZ');
 const apply=()=>{view.centerShadows(frame.camera.position);view.update(frozen,frame.photographer,true);};
 const restore=()=>{view.update(snapshot,frame.photographer);view.centerShadows(frame.camera.position);};
 restore();apply();scene.updateMatrixWorld(true);
 const alignment=(subjectIds||[]).map(id=>{const a=frame.animals.find(a=>a.id===id);if(!a)return{id,error:'Missing frame subject'};const candidates=scene.children.filter(o=>o.position.distanceTo(new THREE.Vector3(...a.pose.position))<1e-5&&findPart(o,'PhotoBody'));if(candidates.length!==1)return{id,species:a.species,behavior:a.behavior,markerCheck:'unavailable or ambiguous',candidates:candidates.map(o=>o.name)};const root=candidates[0],expected=subjectPoints(a,frame.tick).map(p=>propPoint(p,a.pose));return{id,species:a.species,behavior:a.behavior,points:['PhotoBody','PhotoHead'].map((name,i)=>{const part=findPart(root,name);if(!part)return{name,missing:true};const actual=part.getWorldPosition(new THREE.Vector3()).toArray();return{name,actual,expected:expected[i],error:Math.hypot(...actual.map((n,k)=>n-expected[i][k]))};})};});
 renderer.render(scene,cam);
 const blob=await capturePhoto(renderer,scene,frame,world,apply,restore),bytes=await blob.arrayBuffer();
 const repeat=await capturePhoto(renderer,scene,frame,world,apply,restore),repeatHash=await digest(await repeat.arrayBuffer()),jpegHash=await digest(bytes);
 apply();renderer.render(scene,cam);
 const img=document.querySelector('img');if(img.src)URL.revokeObjectURL(img.src);img.src=URL.createObjectURL(blob);document.querySelector('h1').textContent=data.name;
 return {jpeg:Array.from(new Uint8Array(bytes)),jpegHash,repeatHash,repeatIdentical:jpegHash===repeatHash,alignment,worldHash,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,isFallbackAdapter:adapter.info.isFallbackAdapter},bytes:blob.size,errors:view.errors};
};window.renderReady=true;
window.closeRender=()=>{view?.dispose();renderer.dispose();};
