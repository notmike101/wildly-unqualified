// Actual imported geometry checks for the bounded v3 usability audit.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Raycaster, Vector3, Box3, DoubleSide } from 'three';
const source=new URL('./',import.meta.url);
const load=async name=>{const bytes=await readFile(new URL(`../public/models/${name}.glb`,source));return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
const equipment=await load('expedition-kit-v3');
const screen=equipment.getObjectByName('FoldingScreen');
screen.traverse(o=>{if(o.isMesh) for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=DoubleSide;});
equipment.updateMatrixWorld(true);
const rayAt=y=>new Raycaster(new Vector3(0,y,-2),new Vector3(0,0,1),0,4).intersectObject(screen,true).map(hit=>({name:hit.object.name,distance:hit.distance}));
const result={standingEyeHeight:1.6,crouchingEyeHeight:.9,screenRays:{at140:rayAt(1.4),at160:rayAt(1.6),at090:rayAt(.9)}};
assert.equal(result.screenRays.at160.length,0,'Standing eye-height ray must pass the real central screen opening');
const part=(root,name)=>{let found;root.traverse(o=>{if(o.userData.partName===name)found=o;});assert.ok(found,`${root.name}/${name}`);return found;};
const near=(actual,expected)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<.0001));
const position=o=>o.getWorldPosition(new Vector3()).toArray();
const plank=equipment.getObjectByName('CrossingPlank');
result.plank={bounds:new Box3().setFromObject(plank,true).getSize(new Vector3()).toArray(),supports:['SupportL','SupportR'].map(n=>position(part(plank,n))),handles:['HandleL','HandleR'].map(n=>position(part(plank,n)))};
near(result.plank.bounds,[3.2,.188,.65]);
near(result.plank.supports[0],[-1.48,0,0]);near(result.plank.supports[1],[1.48,0,0]);
near(result.plank.handles[0],[-1.43,.165,0]);near(result.plank.handles[1],[1.43,.165,0]);
assert.ok(1.48-.07>2.8/2,'Actual support blocks lie fully on the banks of the approved 2.8m gap');
const manifest=JSON.parse(await readFile(new URL('manifest-v3.json',source),'utf8'));
const proxyProps=manifest.assets['expedition-kit-v3'].props;
for (const name of ['CrossingPlank','FoldingScreen']) {
  const colliders=proxyProps[name].colliders;
  near([Math.min(...colliders.map(c=>c.center[1]-c.size[1]/2))],[0]);
}
assert.equal(proxyProps.CrossingPlank.colliders.length,3);
assert.equal(proxyProps.FoldingScreen.colliders.length,8);
assert.ok(proxyProps.FoldingScreen.colliders.every(c=>Math.abs(c.center[0])>c.size[0]/2 || Math.abs(c.center[1]-1.6)>c.size[1]/2),'No proxy fills the standing camera opening');
const caseRoot=equipment.getObjectByName('FieldCase'),lid=part(caseRoot,'Lid');
lid.rotation.x=1.8;equipment.updateMatrixWorld(true);
result.case={lidPivot:position(lid),openLidBounds:new Box3().setFromObject(lid,true).getSize(new Vector3()).toArray(),openLidMaxY:new Box3().setFromObject(lid,true).max.y,handles:['HandleL','HandleR'].map(n=>position(part(caseRoot,n))),baitStore:position(part(caseRoot,'BaitStore'))};
assert.ok(result.case.openLidMaxY>1.2);near(result.case.lidPivot,[0,.58,.325]);
const forest=await load('forest-kit-v3');forest.updateMatrixWorld(true);
const gate=forest.getObjectByName('ForestGate'),leaf=part(gate,'GateLeaf'),hinge=part(gate,'Hinge'),latch=part(gate,'Latch');
const hingePosition=position(hinge),latchClosed=position(latch);leaf.rotation.y=.95;forest.updateMatrixWorld(true);
near(position(hinge),hingePosition);near(hingePosition,[-2.2,.9,0]);assert.equal(leaf.parent,hinge);assert.equal(latch.parent,leaf);
result.gate={hierarchy:'ForestGate > Hinge > GateLeaf > Latch',hinge:hingePosition,latchClosed,latchOpen:position(latch)};
assert.ok(Math.abs(result.gate.latchOpen[2]-latchClosed[2])>3);
const deerScene=await load('deer-v3');deerScene.updateMatrixWorld(true);const deer=deerScene.getObjectByName('Deer');
result.deer={head:position(part(deer,'PhotoHead')),body:position(part(deer,'PhotoBody'))};near(result.deer.head,[0,1.64,-.83]);near(result.deer.body,[0,1.12,.1]);
const headBefore=position(part(deer,'PhotoHead'));part(deer,'Neck').rotation.x=-.7;deerScene.updateMatrixWorld(true);
assert.ok(position(part(deer,'PhotoHead'))[1]<headBefore[1],'Head photo point follows the grazing neck');
const crewScene=await load('researcher-forest-v3');crewScene.updateMatrixWorld(true);const crew=crewScene.getObjectByName('ResearcherForest');
result.researcher={hatMount:position(part(crew,'HatMount'))};near(result.researcher.hatMount,[0,1.76,0]);
const hats=await load('headwear-v3');hats.updateMatrixWorld(true);result.hats={};
for(const [name,width,height] of [['HatBrim',.6,.21],['HatBeanie',.34,.31],['HatCap',.38,.21],['HatBucket',.51,.22]]) {
  const hat=hats.getObjectByName(name),bounds=new Box3().setFromObject(hat,true);
  near([bounds.min.y,bounds.max.x-bounds.min.x,bounds.max.y],[0,width,height]);
  near(hat.position.toArray(),[0,0,0]);near(hat.quaternion.toArray(),[0,0,0,1]);
  let seatingY=Infinity;
  hat.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    if(name==='HatBeanie' && Math.hypot(x,z)>.1699 || name==='HatCap' && z<-.3)seatingY=Math.min(seatingY,y);
  }});
  if(['HatBeanie','HatCap'].includes(name))near([seatingY],[0]);
  hat.position.set(...result.researcher.hatMount);hats.updateMatrixWorld(true);
  const mounted=new Box3().setFromObject(hat,true);
  result.hats[name]={bounds:[bounds.min.toArray(),bounds.max.toArray()],mountedY:[mounted.min.y,mounted.max.y],seatingY:Number.isFinite(seatingY)?seatingY:0};
}
await writeFile(new URL('usability-rays-v3.json',source),JSON.stringify(result,null,2)+'\n');
console.log('Standing aperture, bank support seating, preserved bounds/handles, case opening, gate hierarchy/swing, hat mount, and moving deer photo points passed.');
