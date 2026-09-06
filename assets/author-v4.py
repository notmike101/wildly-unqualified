"""Run this module from the visible Blender Python console, then start().

Never use background Blender. The existing scene on disk is preserved; start()
opens a clean scene and writes only new v4 paths. Each model is built by a timer
while Blender is foreground. Call continue_models() after inspecting the first
three species; call finish() after inspecting the nine-species milestone.
"""
import ctypes
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import traceback

import bpy
from mathutils import Euler, Vector

SOURCE=Path(__file__).resolve().parent
sys.path.insert(0,str(SOURCE))
import author as b

spec=importlib.util.spec_from_file_location("wildlife_shapes_v4",SOURCE/"wildlife-shapes-v4.py")
shapes=importlib.util.module_from_spec(spec);spec.loader.exec_module(shapes)
STATE={"models":[],"roots":{},"queue":[],"after":None,"labels":[],"stage":"unbuilt"}


def log(event, **values):
    print(json.dumps({"event":event,**values}),flush=True)


def foreground():
    pid=ctypes.c_ulong()
    ctypes.windll.user32.GetWindowThreadProcessId(ctypes.windll.user32.GetForegroundWindow(),ctypes.byref(pid))
    return pid.value==os.getpid()


def focus(items):
    bpy.ops.object.select_all(action="DESELECT")
    for item in items:
        for obj in b.objects(item):obj.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    for area in bpy.context.screen.areas:
        if area.type=="VIEW_3D":
            area.spaces.active.shading.type="MATERIAL"
            area.spaces.active.overlay.show_extras=False
            area.spaces.active.region_3d.view_rotation=Euler((math.radians(67),0,math.radians(-20))).to_quaternion()
            with bpy.context.temp_override(area=area,region=next(r for r in area.regions if r.type=="WINDOW")):
                bpy.ops.view3d.view_selected(use_all_regions=False)
            area.spaces.active.region_3d.view_distance*=1.15


def arrange():
    for i,root in enumerate(STATE["models"]):
        root.location=b.blender(((i%3-1)*2.6,0,(i//3)*2.4))
    STATE["human"].location=b.blender((-5.1,0,1.4))
    bpy.context.view_layer.update()


def build(name):
    root=shapes.BUILDERS[name]()
    shapes.ground(root)
    group="wildlife-habitat-v4" if name in shapes.PROXIES else "wildlife-kit-v4"
    root.parent=STATE["roots"][group]
    STATE["models"].append(root)
    arrange();focus([root,STATE["human"]])
    log("MODEL_CONSTRUCTED_VISIBLE",name=name,foreground=foreground())


def export(stage):
    manifest=json.loads((SOURCE/"manifest-v4.json").read_text())
    manifest.update(stage=stage,blender=bpy.app.version_string,operation="Actual visible foreground Blender; timer-staged console authoring; no MCP or background execution")
    manifest["sources"]={name:hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ("author.py","author-v4.py","wildlife-shapes-v4.py")}
    manifest["assets"]={}
    for obj in STATE["models"]:obj.location=(0,0,0)
    bpy.context.view_layer.update()
    for group,root in STATE["roots"].items():
        if not root.children:continue
        for obj in bpy.data.objects:
            if "partName" in obj:obj.name="Display_"+str(obj.as_pointer())+"_"+obj["partName"]
        for obj in b.objects(root):obj.name=obj["partName"]
        props={}
        for model in root.children:
            measured=b.measure(model)
            measured.pop("nodes")
            measured["attachments"]={obj["partName"]:[round(float(v),5) for v in b.PIVOTS[obj]] for obj in b.objects(model)}
            measured["parents"]={obj["partName"]:obj.parent["partName"] if obj.parent else None for obj in b.objects(model)}
            measured["pose_rotations_xyz_radians"]=shapes.ACTION_POSES.get(model["partName"],{})
            measured["colliders"]=shapes.PROXIES.get(model["partName"],[])
            props[model["partName"]]=measured
        bpy.ops.object.select_all(action="DESELECT")
        for obj in b.objects(root):obj.select_set(True)
        target=SOURCE.parent/"public"/"models"/(group+".glb")
        bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,export_yup=True,export_animations=False,export_extras=True)
        manifest["assets"][group]={"sha256":hashlib.sha256(target.read_bytes()).hexdigest(),"bytes":target.stat().st_size,"props":props}
    (SOURCE/"manifest-v4.json").write_text(json.dumps(manifest,indent=2)+"\n")
    for group,root in STATE["roots"].items():
        for obj in b.objects(root):obj.name=group+"_"+obj["partName"]
    STATE["stage"]=stage
    arrange();save()
    log("EXPORTED_VISIBLE",stage=stage,count=len(STATE["models"]))


def save():
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"library-v4.blend"),check_existing=False)


def labels():
    for obj in STATE["labels"]:bpy.data.objects.remove(obj,do_unlink=True)
    STATE["labels"]=[]
    for root in STATE["models"]:
        text=bpy.data.curves.new("GalleryLabel","FONT");text.body=root["partName"];text.size=.18;text.align_x="CENTER"
        obj=bpy.data.objects.new("Label_"+root["partName"],text);bpy.context.collection.objects.link(obj)
        obj.location=root.location+b.blender((0,.03,-.85))
        obj.rotation_euler=STATE["camera"].rotation_euler.copy()
        text.materials.append(b.material("Ink"));STATE["labels"].append(obj)


def render(filename, count=None):
    camera=STATE["camera"]
    rows=math.ceil((count or len(STATE["models"]))/3)
    target=b.blender((-.7,.25,(rows-1)*1.2))
    camera.location=target+b.blender((6,10,-16))
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type="ORTHO";camera.data.ortho_scale=10 if rows<=3 else 14
    if rows==1:camera.data.ortho_scale=9
    labels()
    scene=bpy.context.scene
    scene.render.filepath=str(SOURCE/filename)
    bpy.ops.render.render("INVOKE_DEFAULT",write_still=True)


def tick():
    try:
        if bpy.app.is_job_running("RENDER") or not foreground():return 1
        if STATE["queue"]:
            build(STATE["queue"].pop(0));return 5
        after=STATE.pop("after",None)
        if after:after()
        return None
    except Exception:
        traceback.print_exc();return None


def schedule(names, after):
    STATE["queue"]=list(names);STATE["after"]=after
    bpy.app.timers.register(tick,first_interval=3)


def representatives_done():
    export("representatives");render("preview-v4-representatives.png",3)


def animals_done():
    export("animals");render("preview-v4-animals.png",9)


def complete_done():
    export("complete");render("preview-v4-gallery.png")
    bpy.app.timers.register(action_sheet,first_interval=3)


def action_sheet():
    if bpy.app.is_job_running("RENDER") or not foreground():return 2
    for root in STATE["models"]:
        if root["partName"] in shapes.PROXIES:
            for obj in b.objects(root):obj.hide_render=True
            continue
        for obj in b.objects(root):
            rotation=shapes.ACTION_POSES.get(root["partName"],{}).get(obj["partName"])
            if rotation:
                x,y,z=rotation;obj.rotation_euler=(x,-z,y)
    render("preview-v4-actions.png",9)
    bpy.app.timers.register(restore,first_interval=3)
    return None


def restore():
    if bpy.app.is_job_running("RENDER") or not foreground():return 2
    for root in STATE["models"]:
        for obj in b.objects(root):obj.rotation_euler=(0,0,0);obj.hide_render=False
    labels();focus(STATE["models"]+[STATE["human"]]);save()
    log("COMPLETE_VISIBLE",models=len(STATE["models"]),stage=STATE["stage"])
    return None


def continue_models():
    assert STATE["stage"]=="representatives"
    schedule([n for n in shapes.BUILDERS if n not in ("Fox","Squirrel","Owl") and n not in shapes.PROXIES],animals_done)


def finish():
    assert STATE["stage"]=="animals"
    schedule(shapes.PROXIES,complete_done)


def start():
    if bpy.app.background:raise RuntimeError("Visible foreground Blender is required")
    if (SOURCE/"library-v4.blend").exists():raise FileExistsError("Use the existing v4 session; never silently replace it")
    if not foreground():raise RuntimeError("Bring Blender to the foreground before starting")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    b.MATERIALS.clear();b.PIVOTS.clear()
    scene=bpy.context.scene;scene.unit_settings.system="METRIC";scene.unit_settings.scale_length=1
    for group in ("wildlife-kit-v4","wildlife-habitat-v4"):STATE["roots"][group]=b.empty(group)
    STATE["human"]=b.researcher();STATE["human"].name="ResearcherScaleReference"
    data=bpy.data.cameras.new("WildlifeInspectionCamera");camera=bpy.data.objects.new("WildlifeInspectionCamera",data)
    bpy.context.collection.objects.link(camera);STATE["camera"]=camera;scene.camera=camera
    data=bpy.data.lights.new("SoftSun","SUN");data.energy=2.5;data.angle=.25
    sun=bpy.data.objects.new("SoftSun",data);bpy.context.collection.objects.link(sun);sun.rotation_euler=(.5,-.5,-.5)
    bpy.ops.mesh.primitive_plane_add(size=50)
    ground=bpy.context.view_layer.objects.active;ground.name="InspectionGround";ground.location.z=-.015
    ground.data.materials.append(b.material("WarmWhite"))
    scene.world=bpy.data.worlds.new("WildlifeStudio");scene.world.use_nodes=True
    scene.world.node_tree.nodes.get("Background").inputs[0].default_value=(.55,.62,.70,1)
    scene.world.node_tree.nodes.get("Background").inputs[1].default_value=.5
    scene.render.engine="CYCLES";scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=2400;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX"
    save();schedule(("Fox","Squirrel","Owl"),representatives_done)
