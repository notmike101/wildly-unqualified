"""Run inside the existing foreground Blender Python console to revise v3 only."""
import gc
import types
import bpy
from pathlib import Path

source=Path('D:/friendslop-games/games/wildly-unqualified/assets')
callback=next(f for f in gc.get_objects() if type(f) is types.FunctionType and f.__name__=='tick' and f.__globals__.get('SOURCE')==source and bpy.app.timers.is_registered(f))
namespace=callback.__globals__
saved=namespace['STATE']
exec(compile((source/'author-v3.py').read_text().split('if bpy.app.background or bpy.data.filepath')[0],str(source/'author-v3.py'),'exec'),namespace)
namespace['STATE']=saved
bpy.app.timers.unregister(callback)
bpy.app.timers.register(namespace['tick'],first_interval=3)
bpy.app.driver_namespace['v3_author']=namespace
module=namespace['shapes']()
for obj in saved['props'][:2]:
    name=obj['partName']
    temporary=module.BUILDERS[name]().finish('ReplacementV3')
    old=obj.data;obj.data=temporary.data
    bpy.data.objects.remove(temporary,do_unlink=True)
    if old.users==0:bpy.data.meshes.remove(old)
namespace['export']('representatives-refined')
namespace['render']('preview-v3-stage1-refined.png')
print('REFINED_REPRESENTATIVES_VISIBLE')
