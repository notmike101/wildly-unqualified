"""Bounded visible source audit and approved screen-aperture correction."""
import hashlib
import json
import bpy
from mathutils import Vector

ns=bpy.app.driver_namespace['v3_author'];b=ns['b'];state=ns['STATE'];source=ns['SOURCE']
assert not bpy.app.background and bpy.data.filepath==str(source/'library-v3.blend')
props={o['partName']:o for o in state['props']}
positions={o:o.location.copy() for o in state['props']}
visibility={o:o.hide_render for o in bpy.data.objects}
rotations={o:o.rotation_euler.copy() for o in bpy.data.objects}
camera=state['camera'];camera_matrix=camera.matrix_world.copy();camera_type=camera.data.type;camera_scale=camera.data.ortho_scale
screen=props['FoldingScreen'];researcher=props['ResearcherForest']
active=[screen,researcher]

def show(items):
    allowed={o for root in items for o in b.objects(root)}
    for o in bpy.data.objects:
        if o.type=='MESH':o.hide_render=o not in allowed and o.name!='InspectionGround'
    ns['focus'](items)

def start_render(name,position,target,scale):
    camera.location=b.blender(position)
    camera.rotation_euler=(b.blender(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=scale
    bpy.context.scene.render.filepath=str(source/name)
    bpy.ops.render.render('INVOKE_DEFAULT',write_still=True)

def replace_screen():
    module=ns['shapes']();temporary=module.screen()
    for suffix in ('L','R'):
        old=next(o for o in b.objects(screen) if o['partName']=='Panel'+suffix)
        new=next(o for o in b.objects(temporary) if o['partName']=='Panel'+suffix)
        old.data=new.data
    for o in reversed(b.objects(temporary)):bpy.data.objects.remove(o,do_unlink=True)
    export_equipment()

def export_equipment():
    module=ns['shapes']()
    root=state['roots']['expedition-kit-v3']
    for o in root.children:o.location=(0,0,0)
    for o in bpy.data.objects:
        if 'partName' in o:o.name='AuditDisplay_'+str(o.as_pointer())+'_'+o['partName']
    for o in b.objects(root):o.name=o['partName']
    bpy.context.view_layer.update()
    stats=b.measure(root);stats['props']={}
    for prop in root.children:
        name=prop['partName'];p=b.measure(prop)
        for o in b.objects(prop):p['nodes'][o.name]['partName']=o['partName']
        p['colliders']=module.PROXIES.get(name,[])
        p['attachments']={n:v['pivot_m'] for n,v in p['nodes'].items() if v['type']=='EMPTY' and n!=name}
        p['semantic_attachments']={o['partName']:[round(float(v),5) for v in b.PIVOTS[o]] for o in b.objects(prop) if o!=prop}
        p['material_count']=len({m.name for o in b.objects(prop) if o.type=='MESH' for m in o.data.materials})
        stats['props'][name]=p
    manifest=json.loads((source/'manifest-v3.json').read_text())
    previous=manifest['assets']['expedition-kit-v3']['props']['FoldingScreen']
    assert stats['props']['FoldingScreen']['bounds_min_m']==previous['bounds_min_m']
    assert stats['props']['FoldingScreen']['bounds_max_m']==previous['bounds_max_m']
    assert stats['props']['FoldingScreen']['semantic_attachments']==previous['semantic_attachments']
    bpy.ops.object.select_all(action='DESELECT')
    for o in b.objects(root):o.select_set(True)
    target=source.parent/'public'/'models'/'expedition-kit-v3.glb'
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True)
    stats.update(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    manifest['assets']['expedition-kit-v3']=stats
    manifest['sources']['forest-shapes-v3.py']=hashlib.sha256((source/'forest-shapes-v3.py').read_bytes()).hexdigest()
    manifest['sources']['audit-v3.py']=hashlib.sha256((source/'audit-v3.py').read_bytes()).hexdigest()
    manifest['usability_audit']={'screen_aperture_y_m':[1.21,1.79],'standing_eye_y_m':1.6,'bounds_and_semantic_pivots_unchanged':True}
    (source/'manifest-v3.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for group,root in state['roots'].items():
        for o in b.objects(root):o.name=group+'_'+o['partName']
    for o,pos in positions.items():o.location=pos

screen.location=(0,0,0);researcher.location=b.blender((2,0,.1))
for area in bpy.context.screen.areas:
    if area.type=='CONSOLE':area.type='VIEW_3D'
show(active)
phase=0
fitted=None
def audit_tick():
    global phase,fitted
    if bpy.app.is_job_running('RENDER'):return 2
    if phase==0:
        start_render('audit-screen-before-v3.png',(2.8,2.25,-6),(1,1,0),4.8)
    elif phase==1:
        # Wait until the source definition is patched, preserving a real before render.
        if not (source/'audit-apply-v3.txt').exists():return 2
        replace_screen();screen.location=(0,0,0);researcher.location=b.blender((2,0,.1));show(active)
        start_render('audit-screen-after-v3.png',(2.8,2.25,-6),(1,1,0),4.8)
    elif phase==2:
        names=['FieldCase','CrossingPlank','ForestGate','ResearcherForest','Deer','WildlifeDecoy']
        layout=[(-3,0,0),(0,0,-1.5),(2.8,0,2),(1,0,.7),(-3.8,0,3),(-1,0,2)]
        for name,pos in zip(names,layout):props[name].location=b.blender(pos)
        for o in b.objects(props['FieldCase']):
            if o['partName']=='Lid':o.rotation_euler.x=1.8
        for o in b.objects(props['ForestGate']):
            if o['partName']=='GateLeaf':o.rotation_euler.z=.95
        hat=props['HatBrim'];fitted=hat.copy();fitted.data=hat.data;fitted.parent=researcher
        fitted.name='AuditFittedHatV3';bpy.context.collection.objects.link(fitted);fitted.location=b.blender((0,1.76,0))
        show([props[n] for n in names]);fitted.hide_render=False
        start_render('audit-equipment-v3.png',(8,8,-12),(0,1,1),12)
    else:
        for o,pos in positions.items():o.location=pos
        for o,hidden in visibility.items():o.hide_render=hidden
        for o,rot in rotations.items():o.rotation_euler=rot
        if fitted:bpy.data.objects.remove(fitted,do_unlink=True)
        camera.matrix_world=camera_matrix;camera.data.type=camera_type;camera.data.ortho_scale=camera_scale
        ns['focus']([screen,researcher])
        bpy.ops.wm.save_as_mainfile(filepath=str(source/'library-v3.blend'),check_existing=False)
        (source/'audit-finished-v3.txt').write_text('Visible screen correction and audit render sequence finished; transforms restored.\n')
        return None
    phase+=1
    return 3
bpy.app.timers.register(audit_tick,first_interval=3)
