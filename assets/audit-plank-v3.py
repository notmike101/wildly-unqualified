"""Approved support seating correction in the existing foreground Blender."""
from pathlib import Path
audit_source=Path('D:/friendslop-games/games/wildly-unqualified/assets/audit-v3.py')
exec(compile(audit_source.read_text().split('screen.location=(0,0,0);researcher.location=')[0],str(audit_source),'exec'))
plank=props['CrossingPlank'];module=ns['shapes']();temporary=module.plank()
old=next(o for o in b.objects(plank) if o['partName']=='Deck')
new=next(o for o in b.objects(temporary) if o['partName']=='Deck');old.data=new.data
for side,suffix in ((-1,'L'),(1,'R')):
    support=next(o for o in b.objects(plank) if o['partName']=='Support'+suffix)
    b.position(support,'Support'+suffix,(side*1.48,0,0),plank)
for o in reversed(b.objects(temporary)):bpy.data.objects.remove(o,do_unlink=True)
before=json.loads((source/'manifest-v3.json').read_text())['assets']['expedition-kit-v3']['props']['CrossingPlank']
export_equipment()
manifest=json.loads((source/'manifest-v3.json').read_text())
after=manifest['assets']['expedition-kit-v3']['props']['CrossingPlank']
assert after['bounds_min_m']==before['bounds_min_m'] and after['bounds_max_m']==before['bounds_max_m']
for key in ('HandleL','HandleR'):assert after['semantic_attachments'][key]==before['semantic_attachments'][key]
manifest['sources']['audit-plank-v3.py']=hashlib.sha256((source/'audit-plank-v3.py').read_bytes()).hexdigest()
manifest['usability_audit']['plank_support_x_m']=[-1.48,1.48]
manifest['usability_audit']['approved_gap_m']=2.8
(source/'manifest-v3.json').write_text(json.dumps(manifest,indent=2)+'\n')
plank.location=(0,0,0);researcher.location=b.blender((0,0,1.2))
for area in bpy.context.screen.areas:
    if area.type=='CONSOLE':area.type='VIEW_3D'
show([plank,researcher])
plank_phase=0
def plank_tick():
    global plank_phase
    if bpy.app.is_job_running('RENDER'):return 2
    if plank_phase==0:
        start_render('audit-plank-v3.png',(5,3,-6),(0,.65,.5),5.5)
        plank_phase=1;return 3
    for o,pos in positions.items():o.location=pos
    for o,hidden in visibility.items():o.hide_render=hidden
    camera.matrix_world=camera_matrix;camera.data.type=camera_type;camera.data.ortho_scale=camera_scale
    ns['focus']([plank])
    bpy.ops.wm.save_as_mainfile(filepath=str(source/'library-v3.blend'),check_existing=False)
    (source/'audit-plank-finished-v3.txt').write_text('Visible support correction complete; source inspection transforms restored.\n')
    return None
bpy.app.timers.register(plank_tick,first_interval=3)
