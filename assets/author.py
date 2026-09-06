"""Original Wildly Unqualified v1 meshes; run in a fresh background Blender.

blender --background --factory-startup --python author.py -- --version 1
Existing outputs are refused. For another version also pass a new --output-dir
inside public/models. Geometry is authored in game coordinates: metres, Y up,
forward -Z. The isolated .blend and measured manifest are retained in assets/.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import tempfile

import bmesh
import bpy
from mathutils import Vector


PALETTE = {
    "Outfit": "408d87", "Canvas": "dcbd7a", "Cream": "eee3c5",
    "Skin": "c78960", "Boots": "403b36", "Ink": "242f36",
    "Lens": "65c8c8", "Orange": "cc7043", "Metal": "b7c4bd",
    "Fur": "85847b", "FurLight": "b4b1a0", "Mask": "303538",
    "Heron": "6f8795", "Feather": "455c6c", "Beak": "dca746",
    "Wood": "76513b", "Bark": "594638", "Leaf": "607e4d",
    "LeafLight": "82945a", "Rock": "879083", "Reed": "adb069",
}
MATERIALS = {}
PIVOTS = {}


def blender(point):
    """Exporter's Y-up conversion maps this back to the game coordinates."""
    x, y, z = point
    return Vector((x, -z, y))


def material(name):
    if name not in MATERIALS:
        rgb = [int(PALETTE[name][i:i + 2], 16) / 255 for i in (0, 2, 4)]
        linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*linear, 1)
        shader.inputs["Metallic"].default_value = 0.45 if name == "Metal" else 0
        shader.inputs["Roughness"].default_value = 0.28 if name == "Lens" else 0.82
        mat.diffuse_color = (*linear, 1)
        MATERIALS[name] = mat
    return MATERIALS[name]


def position(obj, name, pivot, parent=None):
    obj.name = name
    obj["partName"] = name
    PIVOTS[obj] = Vector(pivot)
    obj.parent = parent
    obj.location = blender(Vector(pivot) - PIVOTS[parent] if parent else pivot)
    return obj


def empty(name, pivot=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return position(obj, name, pivot, parent)


class Mesh:
    """Combine primitive surfaces into one rigid mesh with material groups."""
    def __init__(self):
        self.vertices, self.faces, self.colours = [], [], []

    def add(self, vertices, faces, colour):
        base = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend([tuple(base + i for i in face) for face in faces])
        self.colours.extend([colour] * len(faces))

    def box(self, c, size, colour):
        vertices = [(c[0] + x * size[0] / 2, c[1] + y * size[1] / 2,
                     c[2] + z * size[2] / 2)
                    for x, y, z in ((-1, -1, -1), (1, -1, -1), (1, 1, -1),
                                    (-1, 1, -1), (-1, -1, 1), (1, -1, 1),
                                    (1, 1, 1), (-1, 1, 1))]
        self.add(vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                            (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)], colour)

    def ellipsoid(self, c, radius, colour, sides=10, rings=6):
        vertices = [(c[0], c[1] - radius[1], c[2])]
        for j in range(1, rings):
            latitude = -math.pi / 2 + math.pi * j / rings
            for i in range(sides):
                angle = 2 * math.pi * i / sides
                vertices.append((c[0] + radius[0] * math.cos(latitude) * math.cos(angle),
                                 c[1] + radius[1] * math.sin(latitude),
                                 c[2] + radius[2] * math.cos(latitude) * math.sin(angle)))
        vertices.append((c[0], c[1] + radius[1], c[2]))
        faces = [(0, 1 + (i + 1) % sides, 1 + i) for i in range(sides)]
        for j in range(rings - 2):
            a, b = 1 + j * sides, 1 + (j + 1) * sides
            faces.extend((a + i, a + (i + 1) % sides, b + (i + 1) % sides, b + i)
                         for i in range(sides))
        top = 1 + (rings - 2) * sides
        faces.extend((len(vertices) - 1, top + i, top + (i + 1) % sides) for i in range(sides))
        self.add(vertices, faces, colour)

    def tube(self, start, end, radius, colour, end_radius=None, sides=8):
        start, end = Vector(start), Vector(end)
        axis = (end - start).normalized()
        ref = Vector((0, 1, 0)) if abs(axis.y) < 0.95 else Vector((0, 0, 1))
        u, v = axis.cross(ref).normalized(), None
        v = axis.cross(u).normalized()
        end_radius = radius if end_radius is None else end_radius
        vertices = [tuple(center + r * (u * math.cos(i * math.tau / sides) +
                                       v * math.sin(i * math.tau / sides)))
                    for center, r in ((start, radius), (end, end_radius)) for i in range(sides)]
        faces = [tuple(reversed(range(sides))), tuple(range(sides, 2 * sides))]
        faces.extend((i, (i + 1) % sides, sides + (i + 1) % sides, sides + i) for i in range(sides))
        self.add(vertices, faces, colour)

    def prism(self, polygon, offset, colour):
        n = len(polygon)
        vertices = list(polygon) + [tuple(Vector(p) + Vector(offset)) for p in polygon]
        faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
        faces.extend((i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n))
        self.add(vertices, faces, colour)

    def ring(self, center, outer, inner, height, colour, sides=16):
        x, y, z = center
        vertices = [(x + r * math.cos(i * math.tau / sides), y + h,
                     z + r * math.sin(i * math.tau / sides))
                    for h, r in ((0, outer), (height, outer), (0, inner), (height, inner))
                    for i in range(sides)]
        faces = []
        for i in range(sides):
            j = (i + 1) % sides
            faces.extend(((i, j, sides + j, sides + i),
                          (2 * sides + j, 2 * sides + i, 3 * sides + i, 3 * sides + j),
                          (sides + i, sides + j, 3 * sides + j, 3 * sides + i),
                          (j, i, 2 * sides + i, 2 * sides + j)))
        self.add(vertices, faces, colour)

    def finish(self, name, pivot=(0, 0, 0), parent=None):
        mesh = bpy.data.meshes.new(name + "Mesh")
        mesh.from_pydata([blender(Vector(v) - Vector(pivot)) for v in self.vertices], [], self.faces)
        colours = list(dict.fromkeys(self.colours))
        for colour in colours:
            mesh.materials.append(material(colour))
        for polygon, colour in zip(mesh.polygons, self.colours):
            polygon.material_index = colours.index(colour)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        assert not mesh.validate(), f"Invalid generated mesh: {name}"
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return position(obj, name, pivot, parent)


def camera_mesh(origin=(0, 0, 0)):
    m = Mesh()
    m.box((0, 0.09, 0), (0.27, 0.18, 0.12), "Ink")
    m.box((0, 0.195, 0.007), (0.09, 0.035, 0.065), "Metal")
    m.box((0.105, 0.10, -0.01), (0.047, 0.16, 0.14), "Boots")
    m.tube((0, 0.09, -0.06), (0, 0.09, -0.145), 0.069, "Metal", sides=12)
    m.tube((0, 0.09, -0.147), (0, 0.09, -0.16), 0.057, "Ink", sides=12)
    m.tube((0, 0.09, -0.161), (0, 0.09, -0.164), 0.045, "Lens", sides=12)
    m.box((-0.091, 0.13, -0.062), (0.036, 0.032, 0.008), "Cream")
    m.vertices = [tuple(Vector(v) + Vector(origin)) for v in m.vertices]
    return m


def researcher():
    root = empty("Researcher")
    m = Mesh()
    m.prism([(-0.20, 0.91, -0.13), (0.20, 0.91, -0.13),
             (0.25, 1.39, -0.13), (-0.25, 1.39, -0.13)], (0, 0, 0.27), "Outfit")
    m.box((0, 0.94, 0), (0.40, 0.075, 0.285), "Boots")
    m.box((0, 0.943, -0.15), (0.065, 0.065, 0.018), "Metal")
    m.box((0, 1.195, 0.24), (0.37, 0.43, 0.20), "Orange")
    m.box((0, 1.13, 0.36), (0.30, 0.17, 0.07), "Canvas")
    m.tube((-0.22, 1.455, 0.24), (0.22, 1.455, 0.24), 0.086, "Heron", sides=10)
    for side in (-1, 1):
        m.box((side * 0.15, 1.205, -0.143), (0.055, 0.375, 0.03), "Canvas")
        m.tube((side * 0.115, 1.37, -0.175), (side * 0.105, 1.15, -0.25), 0.013, "Ink")
    body = m.finish("Body", (0, 1.04, 0), root)
    for side, suffix in ((-1, "L"), (1, "R")):
        m = Mesh()
        m.box((side * 0.115, 0.545, 0.015), (0.17, 0.73, 0.20), "Canvas")
        m.box((side * 0.115, 0.09, -0.055), (0.205, 0.18, 0.315), "Boots")
        m.box((side * 0.115, 0.023, -0.055), (0.21, 0.046, 0.32), "Ink")
        m.finish("Leg" + suffix, (side * 0.115, 0.89, 0), body)
        m = Mesh()
        m.tube((side * 0.245, 1.335, 0), (side * 0.30, 1.105, -0.015), 0.092, "Outfit", 0.072)
        m.tube((side * 0.30, 1.12, -0.015), (side * 0.31, 0.955, -0.035), 0.057, "Skin", 0.05)
        m.ellipsoid((side * 0.31, 0.935, -0.04), (0.061, 0.072, 0.062), "Skin", 8, 4)
        m.finish("Arm" + suffix, (side * 0.24, 1.34, 0), body)
    m = Mesh()
    m.tube((0, 1.38, 0), (0, 1.47, 0), 0.075, "Skin")
    m.ellipsoid((0, 1.61, -0.014), (0.137, 0.177, 0.132), "Skin")
    m.ellipsoid((0, 1.59, -0.145), (0.029, 0.038, 0.032), "Skin", 8, 4)
    for side in (-1, 1):
        m.ellipsoid((side * 0.053, 1.651, -0.137), (0.014, 0.017, 0.009), "Ink", 8, 4)
        m.ellipsoid((side * 0.136, 1.61, -0.003), (0.031, 0.046, 0.028), "Skin", 8, 4)
    m.tube((0, 1.755, 0), (0, 1.797, 0), 0.29, "Canvas", sides=14)
    m.tube((0, 1.797, 0), (0, 1.94, 0), 0.175, "Canvas", 0.145, 12)
    m.tube((0, 1.802, 0), (0, 1.83, 0), 0.178, "Boots", 0.172, 12)
    m.finish("Head", (0, 1.455, 0), body)
    grip = empty("CameraGrip", (0, 1.065, -0.24), body)
    camera_mesh((0, 1.065, -0.24)).finish("Camera", (0, 1.065, -0.24), grip)
    empty("TinGrip", (0.31, 0.82, -0.28), body)
    return root


def raccoon():
    root = empty("Raccoon")
    m = Mesh()
    m.ellipsoid((0, 0.345, 0.04), (0.205, 0.245, 0.34), "Fur")
    m.ellipsoid((0, 0.39, 0.18), (0.21, 0.215, 0.21), "Fur")
    m.ellipsoid((0, 0.30, -0.205), (0.15, 0.14, 0.09), "FurLight")
    body = m.finish("Body", (0, 0.34, 0.04), root)
    for side, suffix in ((-1, "L"), (1, "R")):
        for z, prefix in ((-0.19, "Leg"), (0.24, "HindLeg")):
            m = Mesh()
            m.ellipsoid((side * 0.145, 0.175, z), (0.075, 0.155, 0.074), "Fur", 8, 4)
            m.ellipsoid((side * 0.145, 0.045, z - 0.044), (0.063, 0.045, 0.104), "Mask", 8, 4)
            for toe in (-1, 0, 1):
                m.tube((side * 0.145 + toe * 0.022, 0.046, z - 0.13),
                       (side * 0.145 + toe * 0.022, 0.038, z - 0.149), 0.009, "Cream", 0.004, 5)
            m.finish(prefix + suffix, (side * 0.145, 0.30, z), body)
    m = Mesh()
    m.ellipsoid((0, 0.47, -0.327), (0.184, 0.164, 0.16), "FurLight")
    for side in (-1, 1):
        m.prism([(side * 0.075, 0.575, -0.315), (side * 0.171, 0.582, -0.28),
                 (side * 0.138, 0.703, -0.29)], (0, 0, 0.048), "Fur")
        m.prism([(side * 0.094, 0.591, -0.319), (side * 0.154, 0.595, -0.289),
                 (side * 0.136, 0.674, -0.300)], (0, 0, 0.009), "Mask")
        m.ellipsoid((side * 0.09, 0.504, -0.451), (0.087, 0.062, 0.042), "Mask")
        m.ellipsoid((side * 0.076, 0.425, -0.447), (0.095, 0.055, 0.079), "Cream")
        m.ellipsoid((side * 0.085, 0.524, -0.487), (0.026, 0.025, 0.012), "Cream", 8, 4)
        m.ellipsoid((side * 0.085, 0.523, -0.499), (0.014, 0.017, 0.007), "Ink", 8, 4)
    m.ellipsoid((0, 0.456, -0.498), (0.075, 0.053, 0.089), "FurLight")
    m.ellipsoid((0, 0.474, -0.576), (0.038, 0.026, 0.026), "Mask", 8, 4)
    head = m.finish("Head", (0, 0.45, -0.26), body)
    empty("TinGrip", (0, 0.20, -0.61), head)
    m = Mesh()
    # ponytail: rigid ringed tail; add a second joint only if one-pivot motion reads poorly.
    points = [(0, 0.38, 0.29), (0.015, 0.365, 0.37), (0.03, 0.34, 0.45),
              (0.05, 0.32, 0.53), (0.074, 0.31, 0.61), (0.09, 0.318, 0.69),
              (0.094, 0.339, 0.77), (0.084, 0.37, 0.85), (0.061, 0.41, 0.92)]
    for i, (a, b) in enumerate(zip(points, points[1:])):
        m.tube(a, b, 0.093 - i * 0.0047, "FurLight" if i % 2 == 0 else "Mask",
               0.093 - (i + 1) * 0.0047, 10)
    m.ellipsoid(points[-1], (0.054, 0.054, 0.056), "Mask", 8, 4)
    m.finish("Tail", points[0], body)
    return root


def heron():
    root = empty("Heron")
    m = Mesh()
    m.ellipsoid((0, 0.89, 0.055), (0.215, 0.24, 0.345), "Heron")
    m.ellipsoid((0, 0.872, -0.17), (0.145, 0.20, 0.145), "Cream")
    m.tube((0, 0.94, 0.28), (0, 0.78, 0.48), 0.105, "Feather", 0.018)
    body = m.finish("Body", (0, 0.9, 0.035), root)
    for side, suffix in ((-1, "L"), (1, "R")):
        m = Mesh()
        x = side * 0.102
        m.tube((x, 0.75, 0.02), (x, 0.38, 0.095), 0.025, "Beak", 0.02)
        m.ellipsoid((x, 0.38, 0.095), (0.03, 0.036, 0.03), "Wood", 8, 4)
        m.tube((x, 0.38, 0.095), (x, 0.029, 0.01), 0.018, "Beak", 0.014)
        m.ellipsoid((x, 0.022, 0.01), (0.028, 0.022, 0.047), "Beak", 8, 4)
        for offset in (-0.085, 0, 0.085):
            m.tube((x, 0.024, 0.01), (x + offset, 0.012, -0.15 + abs(offset) * 0.4), 0.012, "Beak", 0.007)
        m.tube((x, 0.024, 0.01), (x, 0.012, 0.11), 0.012, "Beak", 0.007)
        m.finish("Leg" + suffix, (x, 0.74, 0.02), body)
        m = Mesh()
        polygon = [(side * x, y, z) for x, y, z in
                   ((0.17, 0.96, -0.05), (0.46, 1.03, -0.10), (0.78, 1.01, -0.01),
                    (1.01, 0.93, 0.105), (0.91, 0.87, 0.32), (0.67, 0.83, 0.39),
                    (0.42, 0.83, 0.32), (0.20, 0.86, 0.20))]
        m.prism(polygon, (0, 0.035, 0), "Heron")
        for i in range(6):
            x = 0.36 + i * 0.105
            z = 0.23 + i * 0.011
            m.prism([(side * x, 0.86, z - 0.04), (side * (x + 0.145), 0.88, z),
                     (side * (x + 0.12), 0.84, z + 0.22), (side * (x + 0.03), 0.83, z + 0.20)],
                    (0, 0.027, 0), "Feather")
        m.finish("Wing" + suffix, (side * 0.18, 0.955, -0.015), body)
    m = Mesh()
    neck_points = [(0, 0.96, -0.17), (0, 1.095, -0.18), (0, 1.21, -0.06),
                   (0, 1.34, -0.065), (0, 1.437, -0.235), (0, 1.455, -0.32)]
    for i, (a, b) in enumerate(zip(neck_points, neck_points[1:])):
        radius = 0.071 - i * 0.006
        m.tube(a, b, radius, "Cream", radius - 0.006, 10)
        m.ellipsoid(b, (radius - 0.003,) * 3, "Cream", 10, 4)
    for side in (-1, 1):
        m.tube((side * 0.06, 1.07, -0.16), (side * 0.057, 1.22, -0.047), 0.014, "Feather", 0.01)
    neck = m.finish("Neck", neck_points[0], body)
    m = Mesh()
    m.ellipsoid((0, 1.466, -0.342), (0.088, 0.094, 0.116), "Cream")
    m.ellipsoid((0, 1.52, -0.31), (0.081, 0.035, 0.10), "Feather", 10, 4)
    m.tube((0, 1.516, -0.244), (0, 1.49, -0.08), 0.03, "Ink", 0.003, 6)
    m.tube((0, 1.446, -0.435), (0, 1.422, -0.758), 0.045, "Beak", 0.002, 4)
    for side in (-1, 1):
        m.ellipsoid((side * 0.074, 1.483, -0.393), (0.019, 0.022, 0.026), "Beak", 8, 4)
        m.ellipsoid((side * 0.09, 1.483, -0.397), (0.008, 0.013, 0.014), "Ink", 8, 4)
    m.finish("Head", (0, 1.446, -0.30), neck)
    return root


def field_kit():
    root = empty("FieldKit")
    m = Mesh()
    m.tube((0, 0.006, 0), (0, 0.192, 0), 0.14, "Outfit", sides=16)
    m.ring((0, 0.19, 0), 0.147, 0.12, 0.028, "Metal")
    m.tube((0, 0.193, 0), (0, 0.197, 0), 0.12, "Ink", sides=16)
    m.tube((0, 0, 0), (0, 0.018, 0), 0.145, "Metal", sides=16)
    m.box((0, 0.10, -0.138), (0.145, 0.105, 0.007), "Cream")
    m.prism([(-0.055, 0.10, -0.144), (0, 0.13, -0.144), (0.045, 0.10, -0.144),
             (0, 0.073, -0.144)], (0, 0, -0.003), "Orange")
    for x, z in ((-0.057, 0), (0.014, -0.053), (0.044, 0.036)):
        m.ellipsoid((x, 0.20, z), (0.028, 0.015, 0.025), "Canvas", 8, 4)
    m.finish("Tin", parent=root)
    camera_mesh().finish("Camera", parent=root)
    m = Mesh()
    m.ellipsoid((0, 0.033, 0.017), (0.037, 0.033, 0.048), "Beak", 10, 4)
    m.box((0, 0.027, -0.055), (0.041, 0.035, 0.078), "Beak")
    m.box((0, 0.027, -0.095), (0.029, 0.013, 0.003), "Ink")
    m.box((0, 0.066, 0.016), (0.024, 0.003, 0.018), "Ink")
    m.finish("Whistle", parent=root)
    m = Mesh()
    m.prism([(-1.2, 0.03, -1.22), (0, 1.58, -1.22), (1.2, 0.03, -1.22)], (0, 0, 2.44), "Orange")
    m.prism([(-0.82, 0.035, -1.229), (0, 1.28, -1.229), (0.82, 0.035, -1.229)], (0, 0, -0.01), "Ink")
    m.prism([(0.07, 1.19, -1.247), (0.93, 0.07, -1.247), (0.58, 0.065, -1.247)], (0, 0, -0.017), "Canvas")
    for z in (-1.255, 1.255):
        for x in (-1.23, 1.23):
            m.tube((x, 0.017, z), (0, 1.60, z), 0.022, "Canvas")
        m.tube((0, 1.61, z), (0, 0.025, z * 1.45), 0.013, "Cream")
        m.tube((0, 0, z * 1.45), (0, 0.095, z * 1.45), 0.021, "Metal")
    m.box((0, 0.012, 0), (2.45, 0.024, 2.51), "Canvas")
    m.finish("Tent", parent=root)
    m = Mesh()
    m.box((0, 0.60, 0), (0.13, 1.20, 0.13), "Wood")
    m.box((0, 1.17, -0.025), (0.90, 0.39, 0.095), "Canvas")
    m.prism([(-0.29, 1.15, -0.079), (0.15, 1.15, -0.079), (0.15, 1.075, -0.079),
             (0.33, 1.205, -0.079), (0.15, 1.325, -0.079), (0.15, 1.25, -0.079),
             (-0.29, 1.25, -0.079)], (0, 0, -0.01), "Outfit")
    m.finish("Sign", parent=root)
    m = Mesh()
    m.tube((-0.80, 0.23, 0), (0.80, 0.23, 0), 0.23, "Bark", sides=12)
    for x in (-0.806, 0.806):
        m.tube((x, 0.23, 0), (x + (0.006 if x > 0 else -0.006), 0.23, 0), 0.197, "Canvas", sides=10)
    m.tube((0.18, 0.27, 0), (0.38, 0.63, 0.04), 0.067, "Bark", 0.045)
    m.finish("Log", parent=root)
    m = Mesh()
    m.prism([(-0.40, 0, -0.24), (0.26, 0, -0.37), (0.49, 0, 0.17), (0.10, 0, 0.37),
             (-0.38, 0, 0.20)], (0.055, 0.27, -0.015), "Rock")
    m.prism([(-0.345, 0.27, -0.255), (0.315, 0.27, -0.385), (0.545, 0.27, 0.155),
             (0.155, 0.27, 0.355), (-0.325, 0.27, 0.185)], (-0.13, 0.14, -0.03), "Rock")
    m.finish("Rock", parent=root)
    m = Mesh()
    m.tube((0, 0, 0), (0, 2.0, 0), 0.19, "Bark", 0.115, 9)
    for a, b in (((0, 1.2, 0), (-0.65, 2.1, 0.06)), ((0, 1.55, 0), (0.65, 2.25, 0.13))):
        m.tube(a, b, 0.075, "Bark", 0.04)
    m.ellipsoid((0, 2.35, 0), (1.02, 1.03, 0.94), "Leaf", 9, 4)
    m.ellipsoid((-0.61, 2.04, 0.035), (0.62, 0.64, 0.64), "LeafLight", 8, 4)
    m.ellipsoid((0.57, 2.3, 0.07), (0.59, 0.63, 0.63), "Leaf", 8, 4)
    m.finish("Tree", parent=root)
    m = Mesh()
    for i, (x, z, height) in enumerate(((-0.20, 0, 0.82), (0.05, -0.12, 1.04),
                                       (0.22, 0.08, 0.91), (-0.02, 0.16, 0.73), (0.12, 0.23, 1.12))):
        m.tube((x, 0, z), (x, height, z), 0.012, "Reed", 0.008, 6)
        m.tube((x, height - 0.12, z), (x, height + 0.02, z),
               0.031, "Wood", 0.026, 8)
        for side in (-1, 1):
            m.prism([(x, 0.26, z), (x + side * 0.12, 0.40, z + 0.015),
                     (x + side * 0.21, 0.64, z + 0.03), (x + side * 0.08, 0.42, z + 0.043)],
                    (0, 0, 0.006), "LeafLight")
    m.finish("Reeds", parent=root)
    return root


def objects(root):
    return [root, *root.children_recursive]


def measure(root):
    meshes = [obj for obj in objects(root) if obj.type == "MESH"]
    points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    low = [min(v[i] for v in points) for i in range(3)]
    high = [max(v[i] for v in points) for i in range(3)]
    game_min, game_max = [low[0], low[2], -high[1]], [high[0], high[2], -low[1]]
    return {"bounds_min_m": [round(v, 5) for v in game_min],
            "bounds_max_m": [round(v, 5) for v in game_max],
            "dimensions_m": [round(b - a, 5) for a, b in zip(game_min, game_max)],
            "triangles": sum(len(p.vertices) - 2 for obj in meshes for p in obj.data.polygons),
            "nodes": {obj.name: {"type": obj.type, "parent": obj.parent.name if obj.parent else None,
                                  "pivot_m": [round(v, 5) for v in PIVOTS[obj]]} for obj in objects(root)}}


def main():
    import sys
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", type=int, default=1)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source = Path(__file__).resolve().parent
    model_root = source.parent / "public" / "models"
    output = (args.output_dir or model_root).resolve()
    if not bpy.app.background or bpy.data.filepath or bpy.data.is_dirty:
        raise RuntimeError("Use a new --background --factory-startup process with an unsaved clean scene.")
    if args.version < 1 or not output.is_relative_to(model_root.resolve()):
        raise ValueError("Use a positive version and an output directory inside this game's public/models.")
    blend_path, report_path = source / f"library-v{args.version}.blend", source / f"manifest-v{args.version}.json"
    builders = {"researcher": researcher, "raccoon": raccoon, "heron": heron, "field-kit": field_kit}
    targets = [output / f"{name}.glb" for name in builders] + [blend_path, report_path]
    if any(path.exists() for path in targets):
        raise FileExistsError("Existing assets are never overwritten; use a new version and output directory.")
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    roots = {name: build() for name, build in builders.items()}
    bpy.context.view_layer.update()
    report = {"version": args.version, "blender": bpy.app.version_string,
              "coordinates": "metres; Y up; forward -Z; ground Y=0; L is negative X",
              "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "assets": {}}
    required = {"researcher": {"Body", "Head", "LegL", "LegR", "ArmL", "ArmR", "CameraGrip", "TinGrip"},
                "raccoon": {"Body", "Head", "LegL", "LegR", "HindLegL", "HindLegR", "Tail", "TinGrip"},
                "heron": {"Body", "Head", "Neck", "LegL", "LegR", "WingL", "WingR"},
                "field-kit": {"Tin", "Camera", "Whistle", "Tent", "Sign", "Log", "Rock", "Tree", "Reeds"}}
    with tempfile.TemporaryDirectory(prefix=".export-", dir=source) as temporary:
        for name, root in roots.items():
            # Blender names are scene-global; only the exported hierarchy gets bare part names.
            for asset, other_root in roots.items():
                for obj in objects(other_root):
                    obj.name = asset + "_" + obj["partName"]
            for obj in objects(root):
                obj.name = obj["partName"]
            stats = measure(root)
            assert required[name] <= {obj.name for obj in objects(root)}, (name, stats["nodes"])
            assert abs(stats["bounds_min_m"][1]) < 0.0001, (name, "feet must touch ground", stats)
            assert name == "field-kit" or stats["triangles"] < 8000, (name, "triangle budget", stats)
            if name == "field-kit":
                stats["props"] = {obj.name: measure(obj) for obj in root.children}
                assert all(abs(p["bounds_min_m"][1]) < 0.0001 for p in stats["props"].values()), stats["props"]
            bpy.ops.object.select_all(action="DESELECT")
            for obj in objects(root):
                obj.select_set(True)
            root["assetVersion"] = args.version
            root["forward"] = "-Z"
            staging, target = Path(temporary) / f"{name}.glb", output / f"{name}.glb"
            bpy.ops.export_scene.gltf(filepath=str(staging), export_format="GLB", use_selection=True,
                                      export_yup=True, export_animations=False, export_extras=True)
            with staging.open("rb") as stream, target.open("xb") as destination:
                shutil.copyfileobj(stream, destination)
            stats.update(bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest())
            report["assets"][name] = stats
    # A separated editing layout is saved only after each zero-origin game export.
    for name, root in roots.items():
        for obj in objects(root):
            obj.name = name + "_" + obj["partName"]
    for name, x in (("researcher", -2.8), ("raccoon", -0.9), ("heron", 1.2)):
        roots[name].location = blender((x, 0, -2.2))
    for i, obj in enumerate(roots["field-kit"].children):
        obj.location = blender(((i % 3 - 1) * 3.8, 0, 1.1 + (i // 3) * 3.6))
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    with report_path.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"status": "EXPORTED", "blender": report["blender"],
                      "manifest": str(report_path), "assets": list(report["assets"])}))


if __name__ == "__main__":
    main()
