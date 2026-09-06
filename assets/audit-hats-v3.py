"""Visible foreground fitting repair; all four hats at the exported HatMount."""
from pathlib import Path
import math
exec(compile(Path('D:/friendslop-games/games/wildly-unqualified/assets/audit-v3.py').read_text().split('screen.location=(0,0,0);researcher.location=')[0],'audit-v3.py','exec'))
module=ns['shapes']()
for name,kind in [('HatBeanie','Beanie'),('HatCap','Cap')]:
    temporary=module.hat(kind)
    props[name].data=temporary.data
    bpy.data.objects.remove(temporary,do_unlink=True)
root=state['roots']['headwear-v3']
for prop in root.children:prop.location=(0,0,0)
for o in bpy.data.objects:
    if 'partName' in o:o.name='FitDisplay_'+str(o.as_pointer())+'_'+o['partName']
for o in b.objects(root):o.name=o['partName']
bpy.context.view_layer.update()
manifest=json.loads((source/'manifest-v3.json').read_text());previous=manifest['assets']['headwear-v3']
stats=b.measure(root);stats['props']={}
for prop in root.children:
    name=prop['partName'];p=b.measure(prop)
    for o in b.objects(prop):p['nodes'][o.name]['partName']=o['partName']
    p['colliders']=module.PROXIES.get(name,[])
    p['attachments']={n:v['pivot_m'] for n,v in p['nodes'].items() if v['type']=='EMPTY' and n!=name}
    p['semantic_attachments']={o['partName']:[round(float(v),5) for v in b.PIVOTS[o]] for o in b.objects(prop) if o!=prop}
    p['material_count']=len({m.name for o in b.objects(prop) if o.type=='MESH' for m in o.data.materials})
    assert p['bounds_min_m'][0]==previous['props'][name]['bounds_min_m'][0]
    assert p['bounds_max_m'][0]==previous['props'][name]['bounds_max_m'][0]
    assert p['bounds_min_m'][1]==0
    stats['props'][name]=p
bpy.ops.object.select_all(action='DESELECT')
for o in b.objects(root):o.select_set(True)
target=source.parent/'public'/'models'/'headwear-v3.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True)
stats.update(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
manifest['assets']['headwear-v3']=stats
for name in ['forest-shapes-v3.py','audit-hats-v3.py']:manifest['sources'][name]=hashlib.sha256((source/name).read_bytes()).hexdigest()
manifest['usability_audit']['hat_fit']={'mount_y_m':1.76,'beanie_height_before_after_m':[.37,.31],'cap_height_before_after_m':[.26,.21],'earlier_visual_audit':'HatBrim only; did not establish Beanie or Cap seating'}
(source/'manifest-v3.json').write_text(json.dumps(manifest,indent=2)+'\n')
for group,r in state['roots'].items():
    for o in b.objects(r):o.name=group+'_'+o['partName']
for o,pos in positions.items():o.location=pos
# Copy real source hierarchies for the fit views; retain all original transforms.
copies=[];actors=[]
for index,name in enumerate(['HatBrim','HatBeanie','HatCap','HatBucket']):
    mapping={}
    for original in b.objects(researcher):
        clone=original.copy();bpy.context.collection.objects.link(clone);clone.name='Fit_'+str(index)+'_'+original['partName'];mapping[original]=clone;copies.append(clone)
        clone.parent=mapping.get(original.parent);clone.matrix_parent_inverse=original.matrix_parent_inverse.copy()
    actor=mapping[researcher];actor.parent=None;actor.location=b.blender(((index-1.5)*.95,0,0));actors.append(actor)
    mount=next(o for o in mapping.values() if o['partName']=='HatMount')
    fitted=props[name].copy();bpy.context.collection.objects.link(fitted);copies.append(fitted);fitted.name='Fit_'+name;fitted.parent=mount;fitted.location=(0,0,0);fitted.rotation_euler=(0,0,0)
for area in bpy.context.screen.areas:
    if area.type=='CONSOLE':area.type='VIEW_3D'
show(actors)
render=bpy.context.scene.render;old_resolution=(render.resolution_x,render.resolution_y,render.resolution_percentage)
render.resolution_x=2000;render.resolution_y=1200;render.resolution_percentage=100
hat_phase=0

def hat_tick():
    global hat_phase
    if bpy.app.is_job_running('RENDER'):return 2
    if hat_phase==0:
        start_render('audit-hats-front-v3.png',(0,1.23,-8),(0,1.23,0),4.4)
        hat_phase=1;return 3
    if hat_phase==1:
        for actor in actors:actor.rotation_euler.z=math.pi/2
        start_render('audit-hats-profile-v3.png',(0,1.23,-8),(0,1.23,0),4.4)
        hat_phase=2;return 3
    for o in reversed(copies):bpy.data.objects.remove(o,do_unlink=True)
    for o,pos in positions.items():o.location=pos
    for o,hidden in visibility.items():o.hide_render=hidden
    camera.matrix_world=camera_matrix;camera.data.type=camera_type;camera.data.ortho_scale=camera_scale
    render.resolution_x,render.resolution_y,render.resolution_percentage=old_resolution
    ns['focus']([researcher,props['HatBeanie'],props['HatCap']])
    bpy.ops.wm.save_as_mainfile(filepath=str(source/'library-v3.blend'),check_existing=False)
    manifest['source_scene_sha256']=hashlib.sha256((source/'library-v3.blend').read_bytes()).hexdigest()
    (source/'manifest-v3.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (source/'audit-hats-finished-v3.txt').write_text('Visible corrections and four front/profile fits complete; original inspection transforms restored.\n')
    return None
bpy.app.timers.register(hat_tick,first_interval=3)
