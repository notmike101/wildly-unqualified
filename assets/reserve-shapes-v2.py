"""Original reserve-kit geometry; loaded by the visible author-v2.py session."""
import math
from mathutils import Vector
import author as base

Mesh = base.Mesh
base.PALETTE.update({
    "OakLeaf": "486548", "BirchLeaf": "91a561", "PineLeaf": "35594c",
    "BirchBark": "e5dfc5", "Moss": "718659", "StoneDark": "677576",
    "Berry": "9e4a3e", "Mushroom": "be6246", "Flower": "d497a0",
    "LanternGlow": "f1ce78", "Raincoat": "d5a446", "Vest": "9c6445",
    "DarkFur": "5e615c", "DarkFurLight": "919487", "ReedHeron": "9d977a",
})


def oak_tree():
    m = Mesh()
    m.tube((0, 0, 0), (0.12, 2.9, 0.05), 0.36, "Bark", 0.20, 10)
    for x, y, z in ((-1.2, 3.0, 0), (1.16, 3.4, 0.15), (0.22, 3.5, -0.95), (-0.2, 3.0, 0.9)):
        m.tube((0.06, 1.8, 0), (x, y, z), 0.15, "Bark", 0.07, 8)
        m.ellipsoid((x, y + 0.6, z), (1.28, 1.13, 1.16), "OakLeaf", 9, 5)
    m.ellipsoid((0.05, 4.0, 0.10), (1.35, 1.12, 1.2), "Leaf", 10, 5)
    for angle in range(0, 360, 72):
        a = math.radians(angle)
        m.tube((0, 0.32, 0), (0.74 * math.cos(a), 0.04, 0.74 * math.sin(a)), 0.18, "Bark", 0.07, 7)
    return m


def birch_tree():
    m = Mesh()
    for x, z, top, lean in ((-0.18, 0, 4.0, -0.37), (0.15, 0.1, 4.6, 0.31)):
        m.tube((x, 0, z), (x + lean, top, z + 0.12), 0.12, "BirchBark", 0.058, 9)
        for i in range(10):
            y = 0.22 + i * 0.33
            t = y / top
            m.box((x + lean * t - 0.016, y, z + 0.12 * t - 0.106 + t * 0.04),
                  (0.11 if i % 3 else 0.17, 0.027 + (i % 2) * 0.017, 0.012), "Bark")
        for side, y in ((-1, 2.6), (1, 3.3)):
            end = (x + lean + side * 0.7, y + 0.9, z + 0.22)
            m.tube((x + lean * y / top, y, z + 0.06), end, 0.05, "BirchBark", 0.018, 7)
            m.ellipsoid((end[0], end[1] + 0.16, end[2]), (0.70, 0.71, 0.65), "BirchLeaf", 8, 4)
        m.ellipsoid((x + lean, top + 0.1, z + 0.12), (0.67, 0.73, 0.62), "BirchLeaf", 8, 4)
    return m


def pine_tree():
    m = Mesh()
    m.tube((0, 0, 0), (0, 4.65, 0), 0.19, "Bark", 0.045, 9)
    for y, radius, height in ((0.78, 1.25, 1.5), (1.6, 1.04, 1.5), (2.42, 0.78, 1.38), (3.25, 0.51, 1.38)):
        for i in range(7):
            angle = i * math.tau / 7
            m.tube((0, y + 0.32, 0), (radius * 0.92 * math.cos(angle), y + 0.12, radius * 0.92 * math.sin(angle)),
                   0.035, "Bark", 0.012, 6)
        m.tube((0, y, 0), (0, y + height, 0), radius, "PineLeaf", 0.008, 9)
    return m


def dead_tree():
    m = Mesh()
    points = [(0, 0, 0), (0.05, 1.25, 0), (-0.18, 2.28, 0.02), (0.03, 3.24, -0.08)]
    for i, (a, b) in enumerate(zip(points, points[1:])):
        m.tube(a, b, 0.23 - i * 0.054, "Bark", 0.18 - i * 0.066, 8)
    for a, b, c in (((0, 1.17, 0), (-0.79, 1.94, 0.03), (-1.08, 2.56, 0.08)),
                     ((-0.15, 2.0, 0), (0.66, 2.5, -0.05), (0.88, 3.08, -0.08)),
                     ((0.03, 1.55, 0), (0.2, 2.05, 0.75), (0.1, 2.45, 1.0))):
        m.tube(a, b, 0.10, "Bark", 0.055, 7)
        m.tube(b, c, 0.055, "Wood", 0.013, 7)
    for side in (-1, 1):
        m.tube((0, 0.35, 0), (side * 0.55, 0.04, 0.20), 0.15, "Bark", 0.052, 7)
    return m


def fallen_trunk():
    m = Mesh()
    m.tube((-1.72, 0.34, 0), (1.72, 0.34, 0), 0.34, "Bark", sides=12)
    for x, outward in ((-1.721, -1), (1.721, 1)):
        m.tube((x, 0.34, 0), (x + outward * 0.004, 0.34, 0), 0.292, "Wood", sides=12)
        m.tube((x + outward * 0.006, 0.34, 0), (x + outward * 0.009, 0.34, 0), 0.196, "Ink", sides=12)
    m.tube((-0.23, 0.47, 0.06), (0.12, 1.03, 0.11), 0.12, "Bark", 0.057, 8)
    m.tube((0.79, 0.48, 0), (0.90, 0.88, -0.36), 0.078, "Bark", 0.027, 7)
    for x in (-0.8, 0.14, 0.85):
        m.ellipsoid((x, 0.62, -0.04), (0.39, 0.08, 0.21), "Moss", 8, 4)
    return m


def stump():
    m = Mesh()
    m.tube((0, 0, 0), (0.035, 0.56, -0.01), 0.38, "Bark", 0.30, 11)
    m.tube((0.035, 0.559, -0.01), (0.035, 0.566, -0.01), 0.278, "Canvas", sides=16)
    for radius in (0.21, 0.125, 0.046):
        m.ring((0.035, 0.567, -0.01), radius, radius - 0.012, 0.002, "Wood", 16)
    for i in range(5):
        angle = i * math.tau / 5
        m.tube((0, 0.21, 0), (0.61 * math.cos(angle), 0.025, 0.61 * math.sin(angle)), 0.16, "Bark", 0.055, 7)
    return m


def boulder():
    m = Mesh()
    lower = [(-0.86, 0, -0.41), (-0.20, 0, -0.72), (0.66, 0, -0.46), (0.97, 0, 0.18),
             (0.41, 0, 0.70), (-0.45, 0, 0.73), (-0.94, 0, 0.18)]
    upper = [(-0.72, 0.65, -0.29), (-0.12, 1.03, -0.43), (0.56, 0.84, -0.25), (0.68, 0.52, 0.15),
             (0.31, 0.92, 0.43), (-0.34, 0.74, 0.48), (-0.63, 0.53, 0.14)]
    faces = [tuple(reversed(range(7)))]
    faces.extend((i, (i + 1) % 7, 7 + (i + 1) % 7, 7 + i) for i in range(7))
    faces.extend((7 + i, 7 + (i + 1) % 7, 14) for i in range(7))
    m.add(lower + upper + [(0.03, 1.13, 0.08)], faces, "StoneDark")
    m.ellipsoid((-0.3, 0.77, 0.32), (0.36, 0.054, 0.23), "Moss", 7, 4)
    return m


def flat_rock():
    m = Mesh()
    polygon = [(-0.96, 0, -0.43), (-0.22, 0, -0.64), (0.78, 0, -0.36), (1.01, 0, 0.15),
               (0.42, 0, 0.57), (-0.67, 0, 0.43)]
    m.prism(polygon, (0.025, 0.115, -0.017), "Rock")
    m.prism([(-0.63, 0.115, -0.30), (-0.08, 0.115, -0.48), (0.68, 0.115, -0.30),
             (0.79, 0.115, 0.10), (0.30, 0.115, 0.37), (-0.54, 0.115, 0.29)], (-0.015, 0.063, 0), "StoneDark")
    return m


def fern():
    m = Mesh()
    for i in range(8):
        angle = i * math.tau / 8
        direction = Vector((math.cos(angle), 0, math.sin(angle)))
        sideways = Vector((-direction.z, 0, direction.x))
        previous = Vector((0, 0.015, 0))
        for j in range(1, 7):
            t = j / 6
            center = direction * (0.68 * t)
            center.y = 0.65 * math.sin(t * 1.7)
            m.tube(previous, center, 0.009, "Leaf", 0.005, 5)
            if j > 1:
                width = 0.19 * (1 - t * 0.72)
                for sign in (-1, 1):
                    tip = center + sideways * width * sign - direction * 0.13
                    tip.y += 0.028
                    m.prism([tuple(center - direction * 0.07), tuple(tip),
                             tuple(center + direction * 0.07)], (0, 0.008, 0),
                            "LeafLight" if i % 2 else "Leaf")
            previous = center
    return m


def bush():
    m = Mesh()
    for x, y, z, radius in ((0, 0.42, 0, 0.43), (-0.35, 0.31, 0.09, 0.31),
                             (0.31, 0.29, 0.15, 0.34), (0.02, 0.25, -0.28, 0.29)):
        m.tube((0, 0, 0), (x, y, z), 0.025, "Bark", 0.013, 6)
        m.ellipsoid((x, y, z), (radius, radius * 0.90, radius), "OakLeaf", 8, 4)
    for x, y, z in ((-0.34, 0.48, -0.14), (0.17, 0.65, -0.25), (0.39, 0.34, -0.06), (-0.08, 0.46, -0.46)):
        for dx, dy in ((0, 0), (0.032, 0.009), (0.012, 0.035)):
            m.ellipsoid((x + dx, y + dy, z), (0.025, 0.024, 0.026), "Berry", 7, 4)
    return m


def cattails():
    m = Mesh()
    for i, (x, z, height) in enumerate(((-0.31, 0.02, 1.43), (-0.06, -0.21, 1.7),
                                        (0.20, 0.03, 1.56), (0.34, 0.26, 1.81), (-0.10, 0.27, 1.24))):
        m.tube((x, 0, z), (x, height + 0.09, z), 0.014, "LeafLight", 0.007, 6)
        m.tube((x, height - 0.26, z), (x, height, z), 0.051, "Wood", 0.042, 10)
        for side in (-1, 1):
            m.prism([(x, 0.05, z), (x + side * 0.06, 0.43, z - 0.014),
                     (x + side * 0.20, 0.95, z + 0.08), (x + side * 0.30, 1.11, z + 0.10),
                     (x + side * 0.15, 0.78, z + 0.055), (x + side * 0.027, 0.40, z + 0.026)],
                    (0, 0, 0.008), "LeafLight" if i % 2 else "Leaf")
    return m


def lily_pads():
    m = Mesh()
    for x, z, radius, angle in ((-0.36, 0, 0.32, 0), (0.23, -0.20, 0.27, 0.7),
                                (0.30, 0.30, 0.35, 2.1), (-0.25, 0.47, 0.23, 3.0)):
        polygon = [(x, 0, z)]
        polygon.extend((x + radius * math.cos(angle + 0.23 + i * (math.tau - 0.46) / 14), 0,
                        z + radius * math.sin(angle + 0.23 + i * (math.tau - 0.46) / 14)) for i in range(15))
        m.prism(polygon, (0, 0.014, 0), "Leaf")
        for shift in (0.8, 2.0, 3.3, 4.6):
            m.tube((x, 0.017, z), (x + radius * 0.82 * math.cos(angle + shift), 0.017,
                                    z + radius * 0.82 * math.sin(angle + shift)), 0.004, "LeafLight", 0.002, 5)
    for i in range(7):
        angle = i * math.tau / 7
        m.ellipsoid((0.3 + 0.079 * math.cos(angle), 0.052, 0.30 + 0.079 * math.sin(angle)),
                    (0.057, 0.040, 0.057), "Flower", 7, 4)
    m.ellipsoid((0.30, 0.073, 0.30), (0.042, 0.024, 0.042), "Beak", 8, 4)
    return m


def mushrooms():
    m = Mesh()
    for x, z, height, radius in ((-0.18, 0, 0.23, 0.14), (0.06, 0.14, 0.31, 0.17),
                                 (0.23, -0.10, 0.15, 0.10), (-0.03, -0.17, 0.19, 0.12), (-0.25, 0.20, 0.12, 0.075)):
        m.tube((x, 0, z), (x + 0.009, height * 0.78, z), radius * 0.24, "Cream", radius * 0.20, 8)
        m.ellipsoid((x, height * 0.83, z), (radius, height * 0.16, radius), "Cream", 10, 4)
        m.ellipsoid((x, height * 0.89, z), (radius * 1.03, height * 0.27, radius * 1.03), "Mushroom", 10, 4)
        for angle in (0.3, 2.1, 4.2):
            m.ellipsoid((x + radius * 0.46 * math.cos(angle), height * 1.095,
                         z + radius * 0.46 * math.sin(angle)), (radius * 0.13, 0.005, radius * 0.13), "Cream", 7, 4)
    return m


def bird_nest():
    m = Mesh()
    for layer, radius in enumerate((0.16, 0.22, 0.255, 0.26)):
        for i in range(18):
            angle = i * math.tau / 18 + layer * 0.29
            a = (radius * math.cos(angle), 0.027 + layer * 0.034, radius * math.sin(angle))
            b = (radius * math.cos(angle + 0.51), 0.033 + layer * 0.034, radius * math.sin(angle + 0.51))
            m.tube(a, b, 0.015, "Wood" if i % 2 else "Canvas", 0.009, 5)
    for i in range(8):
        x = -0.18 + i * 0.05
        m.tube((x, 0.015, -0.13), (x + 0.045, 0.015, 0.13), 0.012, "Bark", sides=5)
    for x, z in ((-0.062, 0.0), (0.060, 0.035), (0.0, -0.075)):
        m.ellipsoid((x, 0.076, z), (0.043, 0.059, 0.045), "Lens", 8, 5)
    return m


def raccoon_tracks():
    m = Mesh()
    for i in range(6):
        x, z = (-0.105 if i % 2 else 0.105), i * 0.23 - 0.58
        m.ellipsoid((x, 0.009, z), (0.064, 0.009, 0.056), "Wood", 8, 4)
        for digit in range(5):
            dx = (digit - 2) * 0.025
            length = 0.060 - abs(digit - 2) * 0.011
            m.ellipsoid((x + dx, 0.008, z - 0.040 - length / 2), (0.012, 0.008, length / 2), "Wood", 7, 4)
    return m


def heron_tracks():
    m = Mesh()
    for i in range(4):
        x, z = (-0.10 if i % 2 else 0.10), i * 0.36 - 0.54
        for dx, dz in ((-0.09, -0.15), (0, -0.20), (0.09, -0.15), (0.0, 0.055)):
            m.tube((x, 0.012, z), (x + dx, 0.012, z + dz), 0.014, "Wood", 0.005, 6)
    return m


def observation_blind():
    m = Mesh()
    # The front sight opening is physically open from 1.22 to 1.88 m.
    for x in (-1.34, 1.34):
        for z in (-0.76, 0.86):
            m.tube((x, 0, z), (x, 2.11, z), 0.07, "Bark", 0.062, 8)
    for x in (-1.30, 1.30):
        for y in (0.16, 0.98, 1.96):
            m.box((x, y, 0.06), (0.065, 0.10, 1.64), "Wood")
        for i in range(13):
            z = -0.70 + i * 0.125
            m.tube((x, 0.10, z), (x, 1.99, z), 0.039, "Reed", 0.027, 6)
    for y in (0.13, 1.16, 1.94):
        m.box((0, y, -0.78), (2.72, 0.10, 0.075), "Wood")
    for i in range(23):
        x = -1.26 + i * 0.115
        m.tube((x, 0.1, -0.78), (x, 1.105, -0.78), 0.031, "Reed", 0.021, 6)
    m.box((0, 1.22, -0.74), (2.67, 0.055, 0.29), "Wood")
    m.prism([(-1.49, 2.12, -0.96), (1.49, 2.12, -0.96), (1.49, 1.99, 1.05), (-1.49, 1.99, 1.05)],
            (0, 0.035, 0), "Moss")
    for x in (-0.86, 0.86):
        m.tube((x, 2.12, -0.98), (x, 2.005, 1.06), 0.024, "Canvas", sides=6)
    for i in range(8):
        m.box((-1.17 + i * 0.335, 0.052, 0.10), (0.32, 0.068, 1.60), "Wood")
    return m


def trail_marker():
    m = Mesh()
    m.tube((0, 0, 0), (0, 1.65, 0), 0.064, "Bark", 0.052, 8)
    for y, sign, colour in ((1.38, 1, "Orange"), (1.03, -1, "Outfit")):
        m.prism([(sign * -0.34, y - 0.11, -0.06), (sign * 0.22, y - 0.11, -0.06),
                 (sign * 0.43, y + 0.01, -0.06), (sign * 0.22, y + 0.13, -0.06),
                 (sign * -0.34, y + 0.13, -0.06)], (0, 0, -0.042), colour)
        m.tube((sign * -0.15, y + 0.01, -0.106), (sign * -0.15, y + 0.01, -0.113), 0.058, "Cream", sides=10)
    m.tube((0, 1.65, 0), (0, 1.74, 0), 0.095, "Canvas", 0.009, 8)
    return m


def camp_table():
    m = Mesh()
    for z in (-0.42, -0.21, 0, 0.21, 0.42):
        m.box((0, 0.81, z), (2.18, 0.065, 0.195), "Canvas")
    for x in (-0.76, 0.76):
        m.box((x, 0.735, 0), (0.12, 0.085, 1.02), "Wood")
        for side in (-1, 1):
            m.tube((x, 0.04, side * 0.53), (x, 0.76, side * 0.27), 0.075, "Wood", sides=4)
        m.box((x, 0.31, 0), (0.09, 0.11, 1.00), "Wood")
    m.box((0, 0.31, 0), (1.64, 0.12, 0.11), "Bark")
    for x in (-0.77, 0.77):
        for z in (-0.30, 0.30):
            m.tube((x, 0.845, z), (x, 0.849, z), 0.013, "Metal", sides=6)
    return m


def bench():
    m = Mesh()
    for z in (-0.12, 0.11):
        m.box((0, 0.48, z), (1.68, 0.065, 0.21), "Canvas")
    for x in (-0.63, 0.63):
        for z in (-0.17, 0.19):
            m.box((x, 0.23, z), (0.09, 0.46, 0.09), "Wood")
        m.tube((x, 0.28, 0.17), (x, 1.04, 0.31), 0.053, "Wood", sides=4)
    for y, z in ((0.77, 0.26), (0.97, 0.30)):
        m.box((0, y, z), (1.68, 0.15, 0.055), "Canvas")
    m.box((0, 0.22, 0.10), (1.35, 0.075, 0.08), "Bark")
    return m


def supply_crate():
    m = Mesh()
    for y in (0.075, 0.195, 0.315, 0.435):
        for z in (-0.235, 0.235):
            m.box((0, y, z), (0.68, 0.112, 0.045), "Canvas")
        for x in (-0.325, 0.325):
            m.box((x, y, 0), (0.047, 0.112, 0.44), "Wood")
    for x in (-0.27, 0.27):
        for z in (-0.27, 0.27):
            m.box((x, 0.25, z), (0.072, 0.5, 0.021), "Metal")
    for z in (-0.192, -0.096, 0, 0.096, 0.192):
        m.box((0, 0.503, z), (0.69, 0.035, 0.09), "Canvas")
    m.box((0, 0.02, 0), (0.67, 0.04, 0.49), "Wood")
    m.box((0, 0.32, -0.263), (0.19, 0.035, 0.025), "Ink")
    for x in (-0.102, 0.102):
        m.box((x, 0.286, -0.267), (0.025, 0.073, 0.037), "Metal")
    m.box((0, 0.251, -0.27), (0.225, 0.021, 0.037), "Metal")
    m.box((0, 0.419, -0.271), (0.061, 0.11, 0.023), "Metal")
    return m


def lantern():
    m = Mesh()
    m.tube((0, 0, 0), (0, 0.053, 0), 0.106, "Ink", 0.103, 12)
    m.tube((0, 0.055, 0), (0, 0.236, 0), 0.078, "LanternGlow", 0.071, 10)
    for angle in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
        x, z = 0.084 * math.cos(angle), 0.084 * math.sin(angle)
        m.tube((x, 0.037, z), (x, 0.253, z), 0.009, "Metal", sides=6)
    m.tube((0, 0.238, 0), (0, 0.28, 0), 0.108, "Ink", 0.048, 12)
    m.tube((0, 0.278, 0), (0, 0.305, 0), 0.041, "Metal", 0.031, 10)
    points = [(0.086 * math.cos(i * math.pi / 10), 0.294 + 0.096 * math.sin(i * math.pi / 10), 0) for i in range(11)]
    for a, b in zip(points, points[1:]):
        m.tube(a, b, 0.01, "Ink", sides=6)
    glow = base.material("LanternGlow").node_tree.nodes.get("Principled BSDF")
    glow.inputs["Emission Color"].default_value = (0.8, 0.38, 0.07, 1)
    glow.inputs["Emission Strength"].default_value = 0.65
    return m


def field_notebook():
    m = Mesh()
    m.box((0, 0.012, 0), (0.42, 0.024, 0.29), "Wood")
    for side in (-1, 1):
        m.prism([(side * 0.014, 0.044, -0.129), (side * 0.199, 0.027, -0.129),
                 (side * 0.199, 0.027, 0.129), (side * 0.014, 0.044, 0.129)], (0, 0.007, 0), "Cream")
    for z in (-0.1, -0.05, 0, 0.05, 0.1):
        points = [(0.019 * math.cos(i * math.pi / 7), 0.046 + 0.014 * math.sin(i * math.pi / 7), z) for i in range(8)]
        for a, b in zip(points, points[1:]):
            m.tube(a, b, 0.0025, "Metal", sides=5)
    for z in (-0.078, -0.043, -0.008, 0.027, 0.062, 0.097):
        m.tube((0.04, 0.050, z), (0.177, 0.037, z), 0.0017, "Heron", sides=5)
    for a, b in (((-0.14, 0.10), (-0.14, 0.022)), ((-0.07, 0.10), (-0.07, 0.022)),
                 ((-0.14, 0.022), (-0.08, -0.024)), ((-0.08, -0.024), (-0.11, -0.074)),
                 ((-0.11, -0.074), (-0.051, -0.095)), ((-0.14, 0.10), (-0.17, 0.12)),
                 ((-0.07, 0.10), (-0.04, 0.12))):
        m.tube((a[0], 0.046 - abs(a[0]) * 0.06, a[1]), (b[0], 0.046 - abs(b[0]) * 0.06, b[1]), 0.0028, "Ink", sides=5)
    return m


def camera_tripod():
    m = Mesh()
    for i in range(3):
        angle = i * math.tau / 3 + math.pi / 2
        x, z = 0.44 * math.cos(angle), 0.44 * math.sin(angle)
        m.tube((x, 0.026, z), (x * 0.12, 1.11, z * 0.12), 0.021, "Metal", 0.017, 8)
        m.tube((x, 0.018, z), (x, 0.066, z), 0.031, "Ink", sides=8)
        m.tube((x * 0.65, 0.40, z * 0.65), (0, 0.42, 0), 0.011, "Ink", sides=6)
    m.tube((0, 0.41, 0), (0, 1.25, 0), 0.027, "Ink", sides=8)
    m.box((0, 1.25, 0), (0.15, 0.045, 0.13), "Metal")
    m.tube((0.045, 1.20, 0), (0.08, 1.07, 0.31), 0.012, "Ink", sides=6)
    camera = base.camera_mesh((0, 1.275, -0.01))
    for colour in dict.fromkeys(camera.colours):
        faces = [face for face, mat in zip(camera.faces, camera.colours) if mat == colour]
        m.add(camera.vertices, faces, colour)
    return m


def recolour(root, mapping):
    for obj in base.objects(root):
        if obj.type == "MESH":
            for i, mat in enumerate(obj.data.materials):
                if mat.name in mapping:
                    obj.data.materials[i] = base.material(mapping[mat.name])


def part(root, name):
    return next(obj for obj in base.objects(root) if obj["partName"] == name)


def researcher_raincoat():
    root = base.researcher()
    recolour(root, {"Outfit": "Raincoat", "Orange": "PineLeaf", "Heron": "Moss"})
    m = Mesh()
    m.prism([(-0.257, 0.78, -0.165), (0.257, 0.78, -0.165),
             (0.20, 1.035, -0.145), (-0.20, 1.035, -0.145)], (0, 0, 0.33), "Raincoat")
    m.box((0, 1.29, -0.157), (0.073, 0.19, 0.027), "Raincoat")
    for y in (1.34, 1.25, 0.86):
        m.ellipsoid((0, y, -0.179), (0.013, 0.013, 0.004), "Ink", 7, 4)
    m.ellipsoid((0, 1.43, 0.1), (0.175, 0.093, 0.13), "Raincoat", 10, 4)
    m.box((0, 1.20, 0.282), (0.408, 0.475, 0.244), "PineLeaf")
    m.box((0, 1.335, 0.412), (0.34, 0.08, 0.025), "Moss")
    for x in (-0.14, 0.14):
        m.box((x, 1.13, 0.412), (0.035, 0.28, 0.025), "Canvas")
    m.finish("RainGear", (0, 1.04, 0), part(root, "Body"))
    return root


def researcher_vest():
    root = base.researcher()
    recolour(root, {"Outfit": "Cream", "Orange": "Heron", "Heron": "Canvas"})
    m = Mesh()
    for side in (-1, 1):
        m.prism([(side * 0.047, 0.989, -0.17), (side * 0.226, 0.989, -0.15),
                 (side * 0.245, 1.363, -0.15), (side * 0.096, 1.363, -0.15)], (0, 0, 0.035), "Vest")
        m.box((side * 0.145, 1.075, -0.19), (0.105, 0.10, 0.026), "Canvas")
        m.tube((side * 0.247, 1.06, 0.28), (side * 0.247, 1.32, 0.28), 0.057, "Lens", 0.044, 10)
        m.tube((side * 0.247, 1.32, 0.28), (side * 0.247, 1.37, 0.28), 0.029, "Metal", sides=8)
    m.box((0, 1.235, 0.409), (0.22, 0.12, 0.035), "Cream")
    m.box((0, 1.235, 0.429), (0.11, 0.05, 0.01), "Outfit")
    m.finish("FieldVest", (0, 1.04, 0), part(root, "Body"))
    return root


def raccoon_dark():
    root = base.raccoon()
    recolour(root, {"Fur": "DarkFur", "FurLight": "DarkFurLight"})
    for obj in base.objects(root):
        obj.location.x *= 1.24
        base.PIVOTS[obj].x *= 1.24
        if obj.type == "MESH":
            for vertex in obj.data.vertices:
                vertex.co.x *= 1.24
    m = Mesh()
    m.ellipsoid((0, 0.423, 0.145), (0.242, 0.215, 0.242), "DarkFur", 10, 5)
    m.finish("ShoulderRuff", (0, 0.34, 0.04), part(root, "Body"))
    return root


def heron_reed():
    root = base.heron()
    recolour(root, {"Heron": "ReedHeron", "Feather": "Wood", "Cream": "Canvas"})
    m = Mesh()
    for side in (-1, 1):
        m.tube((side * 0.033, 1.524, -0.24), (side * 0.063, 1.535, -0.025), 0.013, "Ink", 0.0025, 6)
    m.finish("Crest", (0, 1.446, -0.30), part(root, "Head"))
    return root
