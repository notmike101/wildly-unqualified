"""Original mature forest geometry in metres; evaluated by visible author-v3.py."""
import math
import random
import bpy
from mathutils import Vector
import author as b

b.PALETTE.update(PineNeedle="344c3d", PineSun="496148", OakLeaf="4f6544", OakSun="6b7950",
                 CedarLeaf="345449", AlderLeaf="637449", BarkLight="77634d", Moss="647652",
                 Stone="737a72", Earth="655440", LeafLitter="786544", Needle="695940",
                 CrewAccent="468d86", DeerCoat="a37b50", DeerLight="c5aa7d", Rust="9e714c")
Mesh = b.Mesh


def ground(m):
    low = min(v[1] for v in m.vertices)
    m.vertices = [(x, y-low, z) for x,y,z in m.vertices]
    return m


def mature_tree(family, variant):
    m = Mesh()
    seed = {"Pine": 11, "Cedar": 21, "Oak": 31, "Alder": 41}[family] + variant
    rng = random.Random(seed)
    height = {"Pine": (29, 32), "Cedar": (26, 28), "Oak": (24, 27), "Alder": (21, 23)}[family][variant]
    trunk = {"Pine": .66, "Cedar": .83, "Oak": .95, "Alder": .55}[family]
    lean = (1.25 if variant else -.55)
    stem = [(0,0,0), (lean*.1,6,.08), (lean*.4,height*.48,-.2), (lean,height*.8,.4), (lean*.8,height-.5,.2)]
    for i,(a,c) in enumerate(zip(stem,stem[1:])):
        m.tube(a,c,trunk*(1-i*.23),"Bark",trunk*(.77-i*.21),12)
    for i in range(7):
        a=i*math.tau/7+.18*variant
        m.tube((0,.7,0),(math.cos(a)*trunk*2.8,.07,math.sin(a)*trunk*2.8),trunk*.35,"Bark",.055,7)
    broad = family in ("Oak","Alder")
    tiers = 5 if not broad else 3
    colour = {"Pine":"PineNeedle","Cedar":"CedarLeaf","Oak":"OakLeaf","Alder":"AlderLeaf"}[family]
    for tier in range(tiers):
        y = (height*.43 + tier*height*.11) if not broad else (height*.48 + tier*height*.15)
        radius = ((5.2 if family=="Pine" else 6.1) * (1-tier*.16)) if not broad else (5.3-tier*.5)
        count = 5 if not broad else (5 if variant else 4)
        for j in range(count):
            a=j*math.tau/count+tier*.77+variant*.63+rng.uniform(-.19,.19)
            reach=radius*rng.uniform(.65,1.18)
            end=(lean*y/height+math.cos(a)*reach,y+(1.1 if broad else -.65),math.sin(a)*reach)
            origin=(lean*y/height,y-2 if broad else y+.6,0)
            fork=tuple(Vector(origin).lerp(Vector(end),.63)+Vector((0,1.1 if broad else -.1,0)))
            m.tube(origin,fork,.26 if broad else .13,"Bark",.13 if broad else .055,8)
            m.tube(fork,end,.13 if broad else .055,"BarkLight",.028,7)
            if broad:
                factor=rng.uniform(.68,1.15);cy=end[1]+rng.uniform(1.4,3.4)
                crown=(end[0],cy,end[2])
                m.ellipsoid(crown,((3.6 if family=="Oak" else 2.6)*factor,2.5*factor,2.9*factor),colour,9,5)
                m.ellipsoid((end[0]+rng.uniform(-1,1),cy+1.5,end[2]-.5),(1.7*factor,1.8*factor,1.6*factor),"OakSun" if family=="Oak" else colour,8,4)
            else:
                for offset,spread in ((.48,.56),(.86,.35)):
                    cx,cz=end[0]*offset,end[2]*offset
                    cy=y+rng.uniform(-.65,.7);rx=reach*spread;rz=rx*(.6 if family=="Pine" else .86)
                    vertices=[]
                    for h,scale in ((0,1),(.7,.78)):
                        for k in range(10):
                            ang=k*math.tau/10+a;rr=rng.uniform(.78,1.15)
                            vertices.append((cx+math.cos(ang)*rx*rr,cy+h+rng.uniform(-.16,.16),cz+math.sin(ang)*rz*rr))
                    vertices.append((cx-.25,cy+(2.5 if family=="Pine" else 3.1),cz+.18))
                    faces=[tuple(reversed(range(10)))]+[(k,(k+1)%10,10+(k+1)%10,10+k) for k in range(10)]+[(10+k,10+(k+1)%10,20) for k in range(10)]
                    m.add(vertices,faces,"PineSun" if j%4==0 else colour)
    if broad:m.ellipsoid((lean,height-2,.2),(2.4,2,2.2),colour,9,5)
    else:m.tube((lean,height-4,.2),(lean*.8,height,.2),1.5,colour,.015,11)
    # Exact authored height while preserving the generated branching architecture.
    ground(m)
    top=max(v[1] for v in m.vertices)
    m.vertices=[(x,y*height/top,z) for x,y,z in m.vertices]
    return m


def fallen_log(hollow=False):
    m=Mesh()
    length=7.8 if hollow else 8.4
    if hollow:
        ring=Mesh(); ring.ring((0,0,0),.72,.48,length,"Bark",16)
        ring.vertices=[(y-length/2,z+.72,x) for x,y,z in ring.vertices]
        m=ring
        for end in (-length/2,length/2):
            r=Mesh(); r.ring((0,0,0),.723,.478,.03,"BarkLight",16)
            r.vertices=[(y+end,z+.72,x) for x,y,z in r.vertices]
            for face,col in zip(r.faces,r.colours): m.add(r.vertices,[face],col)
    else:
        m.tube((-length/2,.64,0),(length/2,.64,.12),.64,"Bark",.49,14)
        for x,rad in ((-length/2-.015,.56),(length/2+.015,.43)):
            m.tube((x,.64,.06),(x+.014,.64,.06),rad,"BarkLight",sides=14)
            m.tube((x-.001,.64,.06),(x+.016,.64,.06),rad*.55,"Wood",sides=14)
    for i in range(5):
        x=-2.8+i*1.15
        m.tube((x,.9,0),(x+.5,1.65+(i%2)*.3,(-1 if i%2 else 1)*.5),.15,"Bark",.035,7)
        m.ellipsoid((x,1.13,.04),(.72,.1,.34),"Moss",8,4)
    return ground(m)


def fern(variant=0):
    m=Mesh()
    for i in range(9 if variant else 7):
        a=i*math.tau/(9 if variant else 7)+variant*.31
        d=Vector((math.cos(a),0,math.sin(a))); s=Vector((-d.z,0,d.x))
        prev=Vector((0,.015,0))
        for j in range(1,8):
            t=j/7; c=d*(1.25*t*(.85 if variant else 1)); c.y=(1.32 if variant else 1.1)*math.sin(t*2.1)
            m.tube(prev,c,.009,"Leaf",.004,5)
            for side in (-1,1):
                tip=c+s*(.27*(1-t*.7))*side-d*.14;tip.y+=.035
                m.prism([tuple(c-d*.07),tuple(tip),tuple(c+d*.1)],(0,.008,0),"LeafLight" if i%3==0 else "Leaf")
            prev=c
    return ground(m)


BUILDERS={"MaturePineA":lambda:mature_tree("Pine",0), "MatureOakA":lambda:mature_tree("Oak",0),
          "FallenLogWhole":fallen_log,"FernLargeA":fern}
PROXIES={"MaturePineA":[{"shape":"cylinder","center":[0,3,0],"radius":.8,"height":6}],
         "MatureOakA":[{"shape":"cylinder","center":[0,3,0],"radius":1.1,"height":6}],
         "FallenLogWhole":[{"shape":"box","center":[0,.65,.06],"size":[8.4,1.3,1.3]}],"FernLargeA":[]}


def snag(forked=False):
    m=Mesh();height=10 if forked else 13
    m.tube((0,0,0),(.35,height*.65,.15),.66,"Bark",.31,11)
    m.tube((.35,height*.65,.15),(-.15,height,0),.31,"BarkLight",.035,8)
    for i in range(4 if forked else 3):
        a=i*2.2;start=(.2,4+i*1.4,.1);end=(math.cos(a)*(2.3 if forked else 1.8),7+i*1.2,math.sin(a)*2)
        m.tube(start,end,.23,"Bark",.06,8)
        m.tube(end,(end[0]+.3,end[1]+1.2,end[2]-.1),.06,"BarkLight",.008,6)
    for i in range(6):
        a=i*math.tau/6;m.tube((0,.5,0),(math.cos(a)*1.6,.03,math.sin(a)*1.6),.22,"Bark",.04,7)
    return ground(m)


def root_plate():
    m=Mesh();m.ellipsoid((0,1.3,0),(.45,1.5,1.75),"Earth",11,5)
    m.tube((-.2,.7,0),(2.7,.55,.1),.55,"Bark",.35,11)
    for i in range(11):
        a=i*math.tau/11;end=(.15,1.2+1.7*math.cos(a),2*math.sin(a))
        m.tube((0,1.1,0),end,.14,"Bark",.035,7)
        m.tube(end,(end[0]-.6,end[1]+.2,end[2]*1.3),.04,"Bark",.008,6)
    return ground(m)


def boulder(variant=0):
    m=Mesh();rng=random.Random(53+variant)
    count=3 if variant==2 else 1
    for j in range(count):
        cx=(j-1)*1.25 if count>1 else 0;cz=(j%2)*.7
        n=9 if variant==0 else 7
        r=1.7 if variant==0 else 1.25
        lower=[(cx+math.cos(i*math.tau/n)*r,0,cz+math.sin(i*math.tau/n)*r*.85) for i in range(n)]
        upper=[(x*.8,rng.uniform(1.05,1.8),z*.8) for x,y,z in lower]
        faces=[tuple(reversed(range(n)))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]+[(n+i,n+(i+1)%n,2*n) for i in range(n)]
        m.add(lower+upper+[(cx,1.9,cz)],faces,"Stone")
        for i in range(4):m.ellipsoid((cx+(i%2-.5)*.7,1.55+(i%2)*.13,cz+(i//2-.5)*.6),(.64,.17,.55),"Moss",7,4)
    return ground(m)


def root_arch():
    m=Mesh();points=[(-2.5,0,0),(-2.2,1.8,.2),(-1.3,3.2,.3),(0,3.6,.2),(1.4,3.1,.05),(2.3,1.5,-.1),(2.5,0,0)]
    for a,c in zip(points,points[1:]):m.tube(a,c,.36,"Bark",.29,9)
    for side in (-1,1):
        for z in (-.8,.8):m.tube((side*2.4,.55,0),(side*2.9,.02,z),.23,"Bark",.045,7)
    for x in (-1.5,-.5,.5,1.5):m.ellipsoid((x,3.3-abs(x)*.2,.2),(.55,.14,.39),"Moss",8,4)
    return ground(m)


def bank(wet=False):
    m=Mesh();length=6 if wet else 7
    poly=[(-length/2,0,-2),(length/2,0,-2),(length/2,.9,1.8),(-length/2,.9,1.8)]
    m.prism(poly,(0,-.12,0),"Earth")
    for i in range(7):
        x=-length/2+.5+i*(length-1)/6
        m.ellipsoid((x,.73,1.15),(.5,.14,.5),"Moss" if wet else "LeafLitter",7,4)
        m.tube((x,.8,1.5),(x+.28,.2,-.8),.045,"Bark",.017,6)
    return ground(m)


def mat(needles=False):
    m=Mesh();rng=random.Random(72 if needles else 70)
    for i in range(65 if needles else 42):
        a=rng.random()*math.tau;r=math.sqrt(rng.random())*1.65;x=math.cos(a)*r;z=math.sin(a)*r
        if needles:
            m.prism([(x,0,z),(x+.02,.02,z+.26),(x-.02,.02,z+.27)],(0,.007,0),"Needle" if i%3 else "BarkLight")
        else:
            m.prism([(x,0,z),(x+.11,.025,z+.18),(x+.03,.04,z+.35),(x-.1,.02,z+.15)],(0,.007,0),"LeafLitter" if i%3 else "BarkLight")
    return ground(m)


def root_spread():
    m=Mesh()
    for i in range(8):
        a=i*math.tau/8;start=(math.cos(a)*.15,.13,math.sin(a)*.15);end=(math.cos(a)*1.8,.035,math.sin(a)*1.8)
        mid=tuple(Vector(start).lerp(Vector(end),.5)+Vector((.12,.06,-.15)))
        m.tube(start,mid,.12,"Bark",.07,7);m.tube(mid,end,.07,"Bark",.015,6)
        m.tube(mid,(end[0]-.4,.02,end[2]+.4),.055,"Bark",.007,6)
    return ground(m)


def wet_detail(kind):
    m=Mesh();rng=random.Random(89)
    if kind=="lily":
        for i in range(11):
            x=rng.uniform(-1.8,1.8);z=rng.uniform(-1.4,1.4);r=rng.uniform(.22,.46)
            polygon=[(x,0,z)]+[(x+r*math.cos(.35+j*5.6/12),0,z+r*math.sin(.35+j*5.6/12)) for j in range(13)]
            m.prism(polygon,(0,.018,0),"AlderLeaf")
        return m
    for i in range(14 if kind=="reed" else 22):
        a=rng.random()*math.tau;r=rng.random()*(1.2 if kind=="reed" else .55);x=math.cos(a)*r;z=math.sin(a)*r
        h=rng.uniform(1.3,2.3) if kind=="reed" else rng.uniform(.55,.95)
        m.tube((x,0,z),(x+.09,h,z),.012,"Reed",.006,5)
        if kind=="reed":m.tube((x+.08,h-.23,z),(x+.09,h,z),.042,"Wood",.035,8)
        for s in (-1,1):m.prism([(x,.03,z),(x+s*.07,h*.55,z),(x+s*.35,h*.85,z+.13),(x+s*.12,h*.48,z+.025)],(0,0,.009),"AlderLeaf")
    return ground(m)


def gate():
    root=b.empty("ForestGate");m=Mesh()
    for x in (-2.35,2.35):m.box((x,1.05,0),(.23,2.1,.24),"Wood")
    m.finish("GatePosts",parent=root)
    hinge=b.empty("Hinge",(-2.2,.9,0),root);m=Mesh()
    for y in (.45,1.25):m.box((0,y,0),(4.3,.13,.1),"Canvas")
    for x in (-2.05,2.05):m.box((x,.85,0),(.13,1.2,.12),"Wood")
    m.tube((-2,.35,-.03),(2,1.4,-.03),.05,"Wood",sides=4)
    leaf=m.finish("GateLeaf",(-2.2,.9,0),hinge)
    b.empty("Latch",(2.15,1.25,-.08),leaf)
    return root


def trail_board():
    m=Mesh()
    for x in (-.8,.8):m.box((x,1.12,0),(.12,2.24,.15),"Wood")
    m.box((0,1.68,-.03),(1.9,1,.1),"Canvas")
    for x in (-.97,.97):m.box((x,1.68,-.055),(.07,1.13,.15),"Wood")
    for y in (1.12,2.24):m.box((0,y,-.05),(2,.07,.15),"Wood")
    m.prism([(-1.12,2.38,-.3),(1.12,2.38,-.3),(1.12,2.31,.26),(-1.12,2.31,.26)],(0,.04,0),"Bark")
    return m


for family in ("Pine","Cedar","Oak","Alder"):
    for v in range(2):
        name="Mature"+family+"AB"[v]
        BUILDERS[name]=lambda f=family,v=v:mature_tree(f,v)
        PROXIES[name]=[{"shape":"cylinder","center":[0,3,0],"radius":1.1 if family in ("Oak","Cedar") else .8,"height":6}]
BUILDERS.update(SnagTall=snag,SnagForked=lambda:snag(True),HollowLog=lambda:fallen_log(True),RootPlate=root_plate,
                MossBoulderA=boulder,MossBoulderB=lambda:boulder(1),BoulderCluster=lambda:boulder(2),RootArch=root_arch,
                WetBankShelf=lambda:bank(True),DryBankSlope=bank,FernLargeB=lambda:fern(1),LeafMat=mat,
                NeedleMat=lambda:mat(True),RootSpread=root_spread,ReedBed=lambda:wet_detail("reed"),
                LilyPatch=lambda:wet_detail("lily"),SedgeClump=lambda:wet_detail("sedge"),ForestGate=gate,TrailBoard=trail_board)
for n in ("SnagTall","SnagForked"):PROXIES[n]=[{"shape":"cylinder","center":[0,3,0],"radius":.8,"height":6}]
PROXIES.update(HollowLog=[{"shape":"box","center":[0,.72,0],"size":[7.8,1.44,1.44],"note":"low crawl opening visual; not a walkable tunnel"}],
               RootPlate=[{"shape":"box","center":[0,1.5,0],"size":[1,3,3.6]}],
               MossBoulderA=[{"shape":"cylinder","center":[0,.9,0],"radius":1.7,"height":1.8}],
               MossBoulderB=[{"shape":"cylinder","center":[0,.9,0],"radius":1.25,"height":1.8}],
               BoulderCluster=[{"shape":"cylinder","center":[x,.9,.3],"radius":1.25,"height":1.8} for x in (-1.25,0,1.25)],
               RootArch=[{"shape":"cylinder","center":[x,1.2,0],"radius":.5,"height":2.4} for x in (-2.4,2.4)],
               ForestGate=[{"shape":"box","center":[x,1.05,0],"size":[.23,2.1,.24]} for x in (-2.35,2.35)]+[{"shape":"box","node":"GateLeaf","state":"closed","center":[0,.85,0],"size":[4.3,1.2,.12]}],
               TrailBoard=[{"shape":"box","center":[0,1.2,0],"size":[2,2.4,.3]}])
for name,length in (("WetBankShelf",6),("DryBankSlope",7)):
    PROXIES[name]=[{"shape":"ramp","bounds_min":[-length/2,0,-2],"bounds_max":[length/2,1.02,1.8],"rise_axis":"+Z","low_height":.12,"high_height":1.02}]
GROUPS={}


def deer():
    root=b.empty("Deer");m=Mesh()
    m.ellipsoid((0,1.09,.1),(.31,.33,.78),"DeerCoat",12,6)
    m.ellipsoid((0,.99,.28),(.25,.25,.64),"DeerLight",10,5)
    body=m.finish("Body",(0,1.08,.1),root)
    m=Mesh();m.tube((0,1.16,-.46),(0,1.65,-.73),.2,"DeerCoat",.13,10)
    neck=m.finish("Neck",(0,1.2,-.46),body)
    m=Mesh();m.ellipsoid((0,1.65,-.8),(.15,.21,.24),"DeerCoat",10,5)
    m.ellipsoid((0,1.56,-1.02),(.11,.10,.18),"DeerLight",9,5)
    m.ellipsoid((0,1.565,-1.173),(.09,.065,.045),"Ink",8,4)
    for s in (-1,1):m.ellipsoid((s*.127,1.705,-.90),(.025,.025,.02),"Ink",8,4)
    head=m.finish("Head",(0,1.60,-.74),neck)
    for s,suf in ((-1,"L"),(1,"R")):
        m=Mesh();m.prism([(s*.08,1.78,-.71),(s*.24,1.94,-.68),(s*.30,1.84,-.60),(s*.13,1.73,-.64)],(0,0,.035),"DeerCoat")
        m.prism([(s*.12,1.78,-.715),(s*.238,1.9,-.685),(s*.255,1.835,-.64)],(0,0,.008),"DeerLight")
        m.finish("Ear"+suf,(s*.10,1.76,-.68),head)
        for front,z in ((True,-.43),(False,.66)):
            x=s*.21;m=Mesh();knee=(x,.52,z+(.05 if front else -.14));hoof=(x,.09,z-.06)
            m.tube((x,1.05,z),knee,.087,"DeerCoat",.049,8)
            m.tube(knee,hoof,.045,"DeerLight",.035,7)
            m.box((x,.07,z-.10),(.095,.14,.17),"Boots")
            m.finish("Leg"+("F" if front else "B")+suf,(x,1.04,z),body)
    m=Mesh();m.tube((0,1.2,.77),(0,1.10,1.02),.08,"DeerLight",.03,8)
    m.finish("Tail",(0,1.2,.77),body)
    b.empty("PhotoHead",(0,1.64,-.83),head);b.empty("PhotoBody",(0,1.12,.1),body)
    root["graze_neck_rotation_x_rad"]=-.7
    return root


def researcher():
    import bmesh
    root=b.researcher();root["partName"]="ResearcherForest"
    head=next(o for o in b.objects(root) if o["partName"]=="Head")
    bm=bmesh.new();bm.from_mesh(head.data)
    hat_faces=[f for f in bm.faces if head.data.materials[f.material_index].name in ("Canvas","Boots")]
    bmesh.ops.delete(bm,geom=hat_faces,context="FACES");bm.to_mesh(head.data);bm.free();head.data.update()
    for obj in b.objects(root):
        if obj.type=="MESH":
            for i,mat in enumerate(obj.data.materials):
                if mat.name in ("Outfit","Orange"):obj.data.materials[i]=b.material("CrewAccent")
    body=next(o for o in b.objects(root) if o["partName"]=="Body")
    m=Mesh()
    for side in (-1,1):
        m.box((side*.14,1.11,-.17),(.14,.13,.035),"CrewAccent")
        m.box((side*.14,1.17,-.195),(.145,.023,.016),"Canvas")
    m.box((0,1.2,.405),(.31,.36,.08),"CrewAccent")
    m.box((0,1.21,.45),(.16,.1,.018),"Cream")
    m.finish("ForestPockets",(0,1.04,0),body)
    b.empty("HatMount",(0,1.76,0),head)
    return root


def hat(kind):
    m=Mesh()
    if kind=="Brim":
        m.tube((0,0,0),(0,.035,0),.30,"Canvas",sides=16)
        m.tube((0,.035,0),(0,.21,0),.168,"CrewAccent",.135,12)
        m.tube((0,.04,0),(0,.08,0),.169,"Boots",.16,12)
    elif kind=="Beanie":
        m.ellipsoid((0,.125,0),(.165,.125,.155),"CrewAccent",12,6)
        m.tube((0,0,0),(0,.075,0),.17,"CrewAccent",.163,12)
        m.ellipsoid((0,.265,0),(.045,.045,.045),"Canvas",8,4)
    elif kind=="Cap":
        m.ellipsoid((0,.085,.025),(.17,.105,.165),"CrewAccent",12,6)
        m.prism([(-.16,0,-.02),(.16,0,-.02),(.19,-.015,-.23),(.1,-.02,-.32),(-.1,-.02,-.32),(-.19,-.015,-.23)],(0,.025,0),"CrewAccent")
    else:
        m.tube((0,0,0),(0,.06,0),.255,"CrewAccent",.18,14)
        m.tube((0,.06,0),(0,.22,0),.18,"CrewAccent",.145,12)
        m.tube((0,.065,0),(0,.10,0),.181,"Canvas",.172,12)
    return ground(m).finish("Hat"+kind)


def box_proxy(center,size,node=None):
    return {"shape":"box","center":list(center),"size":list(size),**({"node":node} if node else {})}


def field_case():
    root=b.empty("FieldCase");m=Mesh()
    m.box((0,.04,0),(1.3,.08,.65),"CrewAccent")
    for x in (-.62,.62):m.box((x,.31,0),(.06,.54,.65),"CrewAccent")
    for z in (-.295,.295):m.box((0,.31,z),(1.3,.54,.06),"CrewAccent")
    for x in (-.55,.55):
        for z in (-.28,.28):m.box((x,.14,z),(.11,.27,.08),"Metal")
    m.finish("Container",parent=root)
    m=Mesh();m.box((0,.615,0),(1.3,.07,.65),"CrewAccent")
    for x in (-.4,.4):m.box((x,.59,-.338),(.10,.14,.025),"Metal")
    lid=m.finish("Lid",(0,.58,.325),root);lid["open_axis"]="X";lid["open_radians"]=1.8
    for side,suf in ((-1,"L"),(1,"R")):
        m=Mesh()
        for z in (-.13,.13):m.tube((side*.66,.39,z),(side*.75,.39,z),.018,"Metal",sides=6)
        m.tube((side*.75,.39,-.13),(side*.75,.39,.13),.028,"Boots",sides=8)
        m.finish("Handle"+suf,(side*.75,.39,0),root)
    bait=b.empty("BaitStore",(0,.13,0),root);m=Mesh()
    for x in (-.34,0,.34):m.tube((x,.08,0),(x,.34,0),.1,"Canvas",sides=10)
    m.finish("StoredBait",(0,.13,0),bait)
    return root


def plank():
    root=b.empty("CrossingPlank");m=Mesh()
    for z in (-.22,0,.22):m.box((0,.095,z),(3.2,.10,.21),"Canvas")
    for x in (-1.48,1.48):m.box((x,.045,0),(.14,.09,.65),"Wood")
    m.finish("Deck",parent=root)
    for side,suf in ((-1,"L"),(1,"R")):
        b.empty("Support"+suf,(side*1.48,0,0),root)
        m=Mesh();m.tube((side*1.43,.165,-.18),(side*1.43,.165,.18),.023,"Metal",sides=8)
        m.finish("Handle"+suf,(side*1.43,.165,0),root)
    return root


def screen():
    root=b.empty("FoldingScreen")
    for side,suf in ((-1,"L"),(1,"R")):
        m=Mesh();cx=side*.6
        # Standing 1.6 m camera clears the real y=1.21..1.79 central aperture.
        m.box((side*1.17,.97,0),(.06,1.94,.07),"Wood")
        m.box((side*.03,.6,0),(.06,1.2,.07),"Wood")
        m.box((side*.03,1.87,0),(.06,.14,.07),"Wood")
        for y in (.2,1.18,1.82,1.91):m.box((cx,y,0),(1.2,.06,.07),"Wood")
        m.box((cx,.69,.015),(1.14,.92,.025),"CrewAccent")
        m.box((cx,1.865,.015),(1.14,.09,.025),"CrewAccent")
        m.box((side*.87,1.50,.015),(.54,.58,.025),"CrewAccent")
        for x in (side*.12,side*1.1):m.box((x,.04,0),(.12,.08,.65),"Metal")
        panel=m.finish("Panel"+suf,(0,.96,0),root)
        m=Mesh()
        for y in (.96,1.14):m.tube((side*1.18,y,0),(side*1.25,y,.08),.015,"Metal",sides=6)
        m.tube((side*1.25,.96,.08),(side*1.25,1.14,.08),.022,"Boots",sides=8)
        m.finish("Handle"+suf,(side*1.25,1.05,.08),panel)
    return root


def decoy():
    root=b.empty("WildlifeDecoy");m=Mesh()
    for z in (-.24,.24):m.box((0,.035,z),(.8,.07,.12),"Metal")
    for x in (-.22,.22):m.box((x,.34,0),(.035,.62,.07),"Metal")
    polygon=[(-.4,.44,0),(.34,.44,0),(.45,.65,0),(.32,.74,0),(-.1,.71,0),(-.17,.91,0),(-.38,1,0),(-.52,.87,0),(-.39,.77,0)]
    m.prism(polygon,(0,0,.07),"Rust")
    for x in (-.22,.22):m.box((x,.46,-.05),(.09,.14,.018),"Canvas")
    m.finish("DecoySilhouette",parent=root)
    m=Mesh();m.ring((.28,.30,-.23),.11,.085,.075,"Canvas",12)
    m.finish("BaitCup",(.28,.3,-.23),root)
    m=Mesh();m.tube((-.15,.45,.15),(.15,.45,.15),.025,"Metal",sides=8)
    m.finish("Handle",(0,.45,.15),root)
    return root


BUILDERS.update(Deer=deer,ResearcherForest=researcher,HatBrim=lambda:hat("Brim"),HatBeanie=lambda:hat("Beanie"),
                HatCap=lambda:hat("Cap"),HatBucket=lambda:hat("Bucket"),FieldCase=field_case,CrossingPlank=plank,
                FoldingScreen=screen,WildlifeDecoy=decoy)
GROUPS.update(Deer="deer-v3",ResearcherForest="researcher-forest-v3",**{n:"headwear-v3" for n in ("HatBrim","HatBeanie","HatCap","HatBucket")},
              **{n:"expedition-kit-v3" for n in ("FieldCase","CrossingPlank","FoldingScreen","WildlifeDecoy")})
PROXIES.update(Deer=[{"shape":"capsule","center":[0,.85,0],"radius":.35,"height":1.3}],ResearcherForest=[{"shape":"capsule","center":[0,.85,0],"radius":.32,"height":1.7}],
               FieldCase=[box_proxy((0,.325,0),(1.3,.65,.65))],CrossingPlank=[box_proxy((0,.095,0),(3.2,.1,.65))]+[box_proxy((s*1.48,.045,0),(.14,.09,.65)) for s in (-1,1)],
               FoldingScreen=[box_proxy((0,.70,0),(2.4,1.02,.07)),box_proxy((0,1.865,0),(2.4,.15,.07))]+[box_proxy((s*.87,1.50,0),(.66,.64,.07)) for s in (-1,1)]+[box_proxy((x,.04,0),(.12,.08,.65)) for x in (-1.1,-.12,.12,1.1)],
               WildlifeDecoy=[box_proxy((0,.5,0),(.8,1,.55))])
