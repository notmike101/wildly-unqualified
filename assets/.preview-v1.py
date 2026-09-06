import bpy
from mathutils import Vector
from pathlib import Path

def p(x, y, z):
    return Vector((x, -z, y))

for obj in bpy.data.objects:
    if obj.name.startswith('field-kit_'):
        obj.hide_render = True
bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
mat = bpy.data.materials.new('PreviewFloor')
mat.diffuse_color = (0.30, 0.34, 0.29, 1)
floor.data.materials.append(mat)
camera_data = bpy.data.cameras.new('PreviewCamera')
camera = bpy.data.objects.new('PreviewCamera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = p(-3.4, 2.7, -8.8)
camera.rotation_euler = (p(-0.85, 0.85, -2.2) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 6.5
bpy.context.scene.camera = camera
for name, location, energy, size in [('Key', (-3, 6, -5), 1800, 5), ('Fill', (4, 4, -4), 1200, 4), ('Rim', (1, 5, 2), 1700, 4)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = p(*location)
    obj.rotation_euler = (p(-0.5, 0.8, -2.2) - obj.location).to_track_quat('-Z', 'Y').to_euler()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1600, 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(Path(__file__).parent / 'preview-v1.png')
scene.world.color = (0.2, 0.2, 0.2)
bpy.ops.render.render(write_still=True)
