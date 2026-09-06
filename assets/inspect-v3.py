"""Final visible source-render QA; run in the existing v3 Blender console."""
import bpy
from mathutils import Vector
ns=bpy.app.driver_namespace['v3_author']
b=ns['b'];state=ns['STATE'];source=ns['SOURCE']
assert bpy.data.filepath==str(source/'library-v3.blend')
items=[o for o in state['props'] if o.parent!=state['roots']['forest-kit-v3']]
positions={o:o.location.copy() for o in items}
visibility={o:o.hide_render for o in bpy.data.objects}
allowed={o for root in items for o in b.objects(root)}
for o in bpy.data.objects:
    if o.type=='MESH' and o not in allowed and o.name!='InspectionGround':o.hide_render=True
for i,o in enumerate(items):o.location=b.blender(((i%5-2)*3.5,0,(i//5)*3.2))
researcher=next(o for o in items if o['partName']=='ResearcherForest')
hat=next(o for o in items if o['partName']=='HatBrim')
fitted=hat.copy();fitted.data=hat.data;fitted.parent=researcher;fitted.name='InspectionFittedHat'
bpy.context.collection.objects.link(fitted);fitted.location=b.blender((0,1.76,0))
camera=state['camera'];camera.data.type='ORTHO';camera.data.ortho_scale=21
camera.location=b.blender((9,12,-21));camera.rotation_euler=(b.blender((0,.5,1.5))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.render.filepath=str(source/'equipment-preview-v3.png')
for area in bpy.context.screen.areas:
    if area.type=='CONSOLE':area.type='VIEW_3D'
phase=0
def inspect_tick():
    global phase
    if bpy.app.is_job_running('RENDER'):return 2
    if phase==0:bpy.ops.render.render('INVOKE_DEFAULT',write_still=True)
    elif phase==1:
        for o,pos in positions.items():o.location=pos
        for o,hidden in visibility.items():o.hide_render=hidden
        fitted.hide_render=True
        for i,(x,z) in enumerate(((-4,-9),(4,-8),(-8,-4),(8,-4),(-10,2),(11,3),(-5,6),(6,8))):
            original=next(o for o in state['props'] if o['partName']==('NeedleMat' if i%2 else 'LeafMat'))
            obj=original.copy();obj.data=original.data;obj.parent=None;obj.name='CompositionMat_'+str(i)
            bpy.context.collection.objects.link(obj);obj.location=b.blender((x,0,z))
        camera.data.type='PERSP';camera.data.lens=23
        camera.location=b.blender((0,1.7,-18));camera.rotation_euler=(b.blender((0,6,5))-camera.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.scene.render.filepath=str(source/'forest-composition-v3.png')
        bpy.ops.render.render('INVOKE_DEFAULT',write_still=True)
    else:
        ns['focus'](state['props'][:4]+[state['scale']])
        bpy.ops.wm.save_as_mainfile(filepath=str(source/'library-v3.blend'),check_existing=False)
        (source/'inspection-v3-complete.txt').write_text('Final equipment and eye-height forest renders inspected after visible generation.\n')
        return None
    phase+=1
    return 3
bpy.app.timers.register(inspect_tick,first_interval=3)
