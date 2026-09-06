"""Visible, incremental Blender authoring of the original version-2 reserve kit.

Run a NEW process: blender --factory-startup --python author-v2.py
This intentionally refuses background operation and existing version-2 output.
The shape module is reloaded when edited so this visible authoring session can
continue constructing real model batches as their definitions are completed.
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile

import bpy
from mathutils import Vector, Quaternion

SOURCE = Path(__file__).resolve().parent
sys.path.insert(0, str(SOURCE))
import author as base

PROPS = [
    ("OakTree", "oak_tree"), ("BirchTree", "birch_tree"), ("PineTree", "pine_tree"),
    ("DeadTree", "dead_tree"), ("FallenTrunk", "fallen_trunk"), ("Stump", "stump"),
    ("Boulder", "boulder"), ("FlatRock", "flat_rock"), ("Fern", "fern"),
    ("Bush", "bush"), ("Cattails", "cattails"), ("LilyPads", "lily_pads"),
    ("Mushrooms", "mushrooms"), ("BirdNest", "bird_nest"),
    ("RaccoonTracks", "raccoon_tracks"), ("HeronTracks", "heron_tracks"),
    ("ObservationBlind", "observation_blind"), ("TrailMarker", "trail_marker"),
    ("CampTable", "camp_table"), ("Bench", "bench"), ("SupplyCrate", "supply_crate"),
    ("Lantern", "lantern"), ("FieldNotebook", "field_notebook"), ("CameraTripod", "camera_tripod"),
]
VARIANTS = [("researcher-raincoat", "researcher_raincoat"), ("researcher-vest", "researcher_vest"),
            ("raccoon-dark", "raccoon_dark"), ("heron-reed", "heron_reed")]
MODELS = SOURCE.parent / "public" / "models"
TARGETS = [MODELS / (name + ".glb") for name in ["reserve-kit", *[n for n, _ in VARIANTS]]]
TARGETS += [SOURCE / "library-v2.blend", SOURCE / "manifest-v2.json", SOURCE / "preview-v2.png"]
STATE = {"step": 0, "roots": {}, "props": [], "labels": [], "module_time": None, "module": None,
         "render_started": False, "done": False}


def load_shapes():
    path = SOURCE / "reserve-shapes-v2.py"
    modified = path.stat().st_mtime_ns
    if modified != STATE["module_time"]:
        spec = importlib.util.spec_from_file_location("reserve_shapes_v2", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        STATE["module"], STATE["module_time"] = module, modified
    return STATE["module"]


def viewport_focus(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.shading.type = "MATERIAL"
            area.spaces.active.overlay.show_floor = True
            with bpy.context.temp_override(area=area, region=next(r for r in area.regions if r.type == "WINDOW")):
                bpy.ops.view3d.view_selected(use_all_regions=False)
            area.spaces.active.region_3d.view_distance *= 1.35
            area.tag_redraw()


def label(text, pos, size=0.22):
    data = bpy.data.curves.new("Label_" + text, "FONT")
    data.body, data.size, data.align_x = text, size, "CENTER"
    obj = bpy.data.objects.new("Label_" + text, data)
    bpy.context.collection.objects.link(obj)
    obj.location = base.blender(pos)
    # Text lies on the ground with its top pointing deeper into the display layout.
    obj.rotation_euler = (0, 0, math.pi)
    data.materials.append(base.material("Ink"))
    STATE["labels"].append(obj)


def display_position(index):
    # Trees at the back; smaller equipment remains nearest the inspection camera.
    return ((index % 6 - 2.5) * 4.2, 0, (3 - index // 6) * 4.5)


def add_prop(name, build):
    mesh = build()
    low = min(vertex[1] for vertex in mesh.vertices)
    mesh.vertices = [(x, y - low, z) for x, y, z in mesh.vertices]
    obj = mesh.finish(name, parent=STATE["roots"]["reserve-kit"])
    STATE["props"].append(obj)
    index = len(STATE["props"]) - 1
    obj.location = base.blender(display_position(index))
    location = display_position(index)
    label(name, (location[0], 0.005, location[2] - 1.6))
    bpy.context.view_layer.update()
    viewport_focus(obj)
    print(json.dumps({"event": "MODEL_CONSTRUCTED_VISIBLE", "model": name,
                      "vertices": len(obj.data.vertices), "triangles": sum(len(p.vertices) - 2 for p in obj.data.polygons)}), flush=True)


def configure_render():
    camera_data = bpy.data.cameras.new("InspectionCamera")
    camera = bpy.data.objects.new("InspectionCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = base.blender((0, 23, -21))
    camera.rotation_euler = (base.blender((0, 0.7, 5.8)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type, camera_data.ortho_scale = "ORTHO", 29
    bpy.context.scene.camera = camera
    for name, point, power, size in (("Key", (-9, 16, -6), 4200, 12), ("Fill", (10, 13, 5), 3500, 12)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = power, "DISK", size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = base.blender(point)
        obj.rotation_euler = (base.blender((0, 0, 5)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor = bpy.context.object
    floor.name = "InspectionFloor"
    floor.location.z = -0.013
    floor.data.materials.append(base.material("Cream"))
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.use_denoising = 24, True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 3600, 2600, 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(SOURCE / "preview-v2.png")
    scene.world.color = (0.3, 0.3, 0.3)


def export_and_save():
    report = {"version": 2, "blender": bpy.app.version_string,
              "coordinates": "metres; Y up; forward -Z; ground Y=0; L is negative X",
              "operation": "visible Blender GUI, timer-staged real construction; no MCP or background Blender",
              "sources": {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest()
                          for name in ("author.py", "author-v2.py", "reserve-shapes-v2.py")}, "assets": {}}
    positions = {obj: obj.location.copy() for root in STATE["roots"].values() for obj in base.objects(root)}
    for root in STATE["roots"].values():
        root.location = (0, 0, 0)
    for obj in STATE["props"]:
        obj.location = (0, 0, 0)
    bpy.context.view_layer.update()
    with tempfile.TemporaryDirectory(prefix=".export-v2-", dir=SOURCE) as temporary:
        for name, root in STATE["roots"].items():
            for asset, other in STATE["roots"].items():
                for obj in base.objects(other):
                    obj.name = asset + "_" + obj["partName"]
            for obj in base.objects(root):
                obj.name = obj["partName"]
            stats = base.measure(root)
            assert abs(stats["bounds_min_m"][1]) < 0.0001, (name, "must be grounded", stats)
            if name == "reserve-kit":
                stats["props"] = {obj.name: base.measure(obj) for obj in root.children}
                assert set(stats["props"]) == {part for part, _ in PROPS}
                assert all(abs(p["bounds_min_m"][1]) < 0.0001 for p in stats["props"].values())
            else:
                assert stats["triangles"] < 8000
            bpy.ops.object.select_all(action="DESELECT")
            for obj in base.objects(root):
                obj.select_set(True)
            root["assetVersion"], root["forward"] = 2, "-Z"
            staging, target = Path(temporary) / (name + ".glb"), MODELS / (name + ".glb")
            bpy.ops.export_scene.gltf(filepath=str(staging), export_format="GLB", use_selection=True,
                                      export_yup=True, export_animations=False, export_extras=True)
            with staging.open("rb") as source, target.open("xb") as destination:
                shutil.copyfileobj(source, destination)
            stats.update(bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest())
            report["assets"][name] = stats
            print(json.dumps({"event": "EXPORTED_VISIBLE", "model": name, "triangles": stats["triangles"]}), flush=True)
    for obj, pos in positions.items():
        obj.location = pos
    for name, root in STATE["roots"].items():
        for obj in base.objects(root):
            obj.name = name + "_" + obj["partName"]
    with (SOURCE / "manifest-v2.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    configure_render()
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "library-v2.blend"), check_existing=False)
    # Select only authored models, then show the entire editing layout.
    bpy.ops.object.select_all(action="DESELECT")
    for root in STATE["roots"].values():
        for obj in base.objects(root):
            obj.select_set(True)
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            with bpy.context.temp_override(area=area, region=next(r for r in area.regions if r.type == "WINDOW")):
                bpy.ops.view3d.view_selected(use_all_regions=False)
    print(json.dumps({"event": "SOURCE_SAVED_VISIBLE", "path": str(SOURCE / "library-v2.blend")}), flush=True)


def tick():
    try:
        if STATE["done"]:
            return None
        step = STATE["step"]
        module = load_shapes()
        if step < len(PROPS):
            name, function = PROPS[step]
            if not hasattr(module, function):
                return 1.0
            add_prop(name, getattr(module, function))
        elif step < len(PROPS) + len(VARIANTS):
            name, function = VARIANTS[step - len(PROPS)]
            if not hasattr(module, function):
                return 1.0
            root = getattr(module, function)()
            STATE["roots"][name] = root
            root.location = base.blender(((step - len(PROPS) - 1.5) * 3.0, 0, -5.0))
            label(name, ((step - len(PROPS) - 1.5) * 3.0, 0.005, -6.2), 0.19)
            bpy.context.view_layer.update()
            viewport_focus(root)
            print(json.dumps({"event": "VARIANT_CONSTRUCTED_VISIBLE", "model": name}), flush=True)
        elif step == len(PROPS) + len(VARIANTS):
            export_and_save()
        elif not STATE["render_started"]:
            STATE["render_started"] = True
            bpy.ops.render.render("INVOKE_DEFAULT", write_still=True)
            print(json.dumps({"event": "VISIBLE_RENDER_STARTED", "path": str(SOURCE / "preview-v2.png")}), flush=True)
            return 2.0
        elif bpy.app.is_job_running("RENDER"):
            return 2.0
        else:
            assert (SOURCE / "preview-v2.png").exists(), "Visible render did not produce its output"
            STATE["done"] = True
            print(json.dumps({"event": "COMPLETE_VISIBLE", "blender": bpy.app.version_string}), flush=True)
            return None
        STATE["step"] += 1
        return 2.0
    except Exception:
        import traceback
        traceback.print_exc()
        print(json.dumps({"event": "AUTHORING_FAILED_VISIBLE", "step": STATE["step"]}), flush=True)
        return None


if bpy.app.background or bpy.data.filepath or bpy.data.is_dirty:
    raise RuntimeError("Start a separate visible Blender with --factory-startup; background and existing scenes are refused.")
if any(path.exists() for path in TARGETS):
    raise FileExistsError("Version-2 files already exist; refusing to overwrite them.")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1.0
STATE["roots"]["reserve-kit"] = base.empty("ReserveKit")
print(json.dumps({"event": "VISIBLE_AUTHORING_STARTED", "blender": bpy.app.version_string}), flush=True)
bpy.app.timers.register(tick, first_interval=2.0)
