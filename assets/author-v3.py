"""Foreground, timer-staged v3 Blender authoring. No background operation."""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import traceback
import bpy
from mathutils import Vector

SOURCE=Path(__file__).resolve().parent
sys.path.insert(0,str(SOURCE))
import author as b

STATE={"roots":{},"props":[],"names":[],"stage":0,"render":False,"module":None,"stamp":None}
MODELS=SOURCE.parent/"public"/"models"
FIRST=["MaturePineA","MatureOakA","FallenLogWhole","FernLargeA"]

def shapes():
    path=SOURCE/"forest-shapes-v3.py"
    if STATE["stamp"]!=path.stat().st_mtime_ns:
        spec=importlib.util.spec_from_file_location("forest_v3",path)
        mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        STATE["module"],STATE["stamp"]=mod,path.stat().st_mtime_ns
    return STATE["module"]

def focus(items):
    bpy.ops.object.select_all(action="DESELECT")
    for item in items:
        for obj in b.objects(item): obj.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    for area in bpy.context.screen.areas:
        if area.type=="VIEW_3D":
            area.spaces.active.shading.type="MATERIAL"
            area.spaces.active.overlay.show_extras=False
            with bpy.context.temp_override(area=area,region=next(r for r in area.regions if r.type=="WINDOW")):
                bpy.ops.view3d.view_selected(use_all_regions=False)
            area.spaces.active.region_3d.view_distance*=1.15

def build(name):
    mod=shapes(); result=mod.BUILDERS[name]()
    if isinstance(result,b.Mesh): result=result.finish(name,parent=STATE["roots"]["forest-kit-v3"])
    else:
        group=mod.GROUPS.get(name,"forest-kit-v3")
        if group not in STATE["roots"]: STATE["roots"][group]=b.empty(group)
        result.parent=STATE["roots"][group]
    i=len(STATE["props"])
    positions={"MaturePineA":(-7,0,3),"MatureOakA":(8,0,5),"FallenLogWhole":(5,0,-5),"FernLargeA":(-3,0,-4)}
    pos=positions.get(name,((i%7-3)*13,0,23+(i//7)*17))
    result.location=b.blender(pos)
    STATE["props"].append(result);STATE["names"].append(name)
    bpy.context.view_layer.update();focus([result])
    print(json.dumps({"event":"MODEL_CONSTRUCTED_VISIBLE","name":name}),flush=True)

def export(stage):
    mod=shapes(); positions={o:o.location.copy() for o in STATE["props"]}
    report={"version":3,"stage":stage,"blender":bpy.app.version_string,"coordinates":"metres; Y up; forward -Z; ground Y=0",
            "operation":"Visible foreground Blender; timer-staged Python authoring; no Blender MCP or background mode",
            "sources":{n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in ("author.py","author-v3.py","forest-shapes-v3.py","revise-v3.py")},"assets":{}}
    for o in STATE["props"]:o.location=(0,0,0)
    bpy.context.view_layer.update()
    for group,root in STATE["roots"].items():
        for obj in bpy.data.objects:
            if "partName" in obj:obj.name="Display_"+str(obj.as_pointer())+"_"+obj["partName"]
        for obj in b.objects(root):obj.name=obj["partName"]
        stats=b.measure(root);stats["props"]={}
        for prop in root.children:
            name=prop["partName"];p=b.measure(prop)
            for obj in b.objects(prop):p["nodes"][obj.name]["partName"]=obj["partName"]
            p["colliders"]=mod.PROXIES.get(name,[])
            p["attachments"]={n:v["pivot_m"] for n,v in p["nodes"].items() if v["type"]=="EMPTY" and n!=name}
            p["semantic_attachments"]={o["partName"]:[round(float(v),5) for v in b.PIVOTS[o]] for o in b.objects(prop) if o!=prop}
            p["material_count"]=len({mat.name for o in b.objects(prop) if o.type=="MESH" for mat in o.data.materials})
            assert abs(p["bounds_min_m"][1])<.0001,(name,"ground",p)
            assert all(min(o.scale)>0 for o in b.objects(prop))
            stats["props"][name]=p
        bpy.ops.object.select_all(action="DESELECT")
        for obj in b.objects(root):obj.select_set(True)
        target=MODELS/(group+".glb")
        bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,export_yup=True,export_animations=False,export_extras=True)
        stats.update(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        report["assets"][group]=stats
    for obj,pos in positions.items():obj.location=pos
    for group,root in STATE["roots"].items():
        for obj in b.objects(root):obj.name=group+"_"+obj["partName"]
    (SOURCE/"manifest-v3.json").write_text(json.dumps(report,indent=2)+"\n")
    bpy.context.view_layer.update()
    focus(STATE["props"][:4]+[STATE["scale"]])
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"library-v3.blend"),check_existing=False)
    print(json.dumps({"event":"EXPORTED_VISIBLE","stage":stage,"models":len(STATE["props"])}),flush=True)

def render(path,eye=False):
    camera=STATE["camera"]
    camera.location=b.blender((0,1.7,-18) if eye else (36,26,-40))
    target=b.blender((0,13,4) if eye else (0,12,3))
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type="PERSP";camera.data.lens=23 if eye else 33
    if path=="preview-v3.png":
        camera.location=b.blender((110,95,-100))
        camera.rotation_euler=(b.blender((0,9,45))-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.type="ORTHO";camera.data.ortho_scale=135
    elif path=="equipment-preview-v3.png":
        camera.location=b.blender((12,13,-24))
        camera.rotation_euler=(b.blender((0,.6,-3))-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.type="ORTHO";camera.data.ortho_scale=21
    world=bpy.context.scene.world;world.use_nodes=True
    world.node_tree.nodes.get("Background").inputs[0].default_value=(.48,.56,.64,1)
    world.node_tree.nodes.get("Background").inputs[1].default_value=.65
    bpy.context.scene.render.filepath=str(SOURCE/path)
    bpy.ops.render.render("INVOKE_DEFAULT",write_still=True)

def compose():
    tree_names=["MaturePineA","MatureCedarB","MatureOakB","MatureAlderA"]
    placements=[(-17,12),(18,13),(-15,-5),(17,-3),(-9,26),(4,28),(20,30),(-25,29)]
    for i,(x,z) in enumerate(placements):
        source=next(o for o in STATE["props"] if o["partName"]==tree_names[i%4])
        obj=source.copy();obj.data=source.data;obj.parent=None
        obj.name="CompositionTree_"+str(i);bpy.context.collection.objects.link(obj)
        obj.location=b.blender((x,0,z));obj.rotation_euler.z=i*.71
    for i,(x,z) in enumerate(((-6,-9),(5,-8),(-9,0),(9,-2),(-12,7),(13,6))):
        source=next(o for o in STATE["props"] if o["partName"]==("FernLargeA" if i%2 else "RootSpread"))
        obj=source.copy();obj.data=source.data;obj.parent=None;obj.name="CompositionFloor_"+str(i)
        bpy.context.collection.objects.link(obj);obj.location=b.blender((x,0,z))

def tick():
    try:
        if bpy.app.is_job_running("RENDER"):return 2
        stage=STATE["stage"]
        if stage<4:build(FIRST[stage])
        elif stage==4:export("representatives");render("preview-v3-stage1.png")
        elif stage==5:
            print(json.dumps({"event":"STAGE_ONE_READY"}),flush=True)
        elif stage==6:
            if not (SOURCE/"continue-v3.txt").exists():return 2
            mod=shapes();remaining=[n for n in mod.BUILDERS if n not in STATE["names"]]
            if remaining:build(remaining[0]);return 2
            if len(STATE["names"])!=39:return 2
        elif stage==7:export("complete");render("preview-v3.png")
        elif stage==8:compose();render("forest-composition-v3.png",True)
        elif stage==9:
            items=[o for o in STATE["props"] if o.parent!=STATE["roots"]["forest-kit-v3"]]
            STATE["detail_positions"]={o:o.location.copy() for o in items}
            for i,obj in enumerate(items):obj.location=b.blender(((i%5-2)*4,0,-10+(i//5)*4))
            render("equipment-preview-v3.png")
        else:
            for obj,pos in STATE.get("detail_positions",{}).items():obj.location=pos
            focus(STATE["props"][:4]+[STATE["scale"]])
            bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"library-v3.blend"),check_existing=False)
            print(json.dumps({"event":"COMPLETE_VISIBLE","models":len(STATE["names"])}),flush=True);return None
        STATE["stage"]+=1
        return 3
    except Exception:traceback.print_exc();return None

if bpy.app.background or bpy.data.filepath or bpy.data.is_dirty:raise RuntimeError("Use a new clean visible Blender process.")
if (SOURCE/"library-v3.blend").exists():raise FileExistsError("Refusing existing v3 session.")
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system="METRIC"
STATE["roots"]["forest-kit-v3"]=b.empty("ForestKitV3")
STATE["scale"]=b.researcher();STATE["scale"].name="HumanScaleReference"
STATE["scale"].location=b.blender((0,0,-5))
data=bpy.data.cameras.new("ForestInspectionCamera");camera=bpy.data.objects.new("ForestInspectionCamera",data)
bpy.context.collection.objects.link(camera);STATE["camera"]=camera;bpy.context.scene.camera=camera
data=bpy.data.lights.new("Sun","SUN");data.energy=3
sun=bpy.data.objects.new("Sun",data);bpy.context.collection.objects.link(sun);sun.rotation_euler=(.5,-.45,-.6)
bpy.ops.mesh.primitive_plane_add(size=230);bpy.context.object.name="InspectionGround";bpy.context.object.location.z=-.02
bpy.context.object.data.materials.append(b.material("Leaf"))
scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.35,.4,.45);scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
bpy.app.timers.register(tick,first_interval=20)
