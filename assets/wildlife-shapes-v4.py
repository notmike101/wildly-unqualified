"""Original rigid-part wildlife, authored with Blender meshes in game metres.

All geometry is new; author.py supplies only the established primitive/export helpers.
Animation rotates semantic rigid parts, not an armature. Coordinates: +Y up, -Z face.
"""
import math
import author as b

b.PALETTE.update({
    "FoxRust": "b9542e", "FoxGold": "d77840", "WarmWhite": "f0dfbb",
    "Chestnut": "87482f", "SquirrelRed": "a95d34", "SoftGrey": "8f928b",
    "RabbitTan": "aa9b80", "EarPink": "c98b80", "BeaverBrown": "644936",
    "TailBrown": "49382d", "OtterBrown": "70523e", "OtterChin": "b8aa88",
    "BadgerGrey": "77796f", "Black": "232823", "White": "e0ddce",
    "OwlBrown": "715b42", "OwlGold": "b29560", "Amber": "e6ad3f",
    "DuckGreen": "285b42", "DuckChest": "705044", "DuckGrey": "9d9e90",
    "DuckBlue": "475d8b", "RedCrest": "b74536", "Mud": "554438",
})


def piece(name, parent, pivot, forms):
    mesh = b.Mesh()
    for method, args in forms:
        getattr(mesh, method)(*args)
    return mesh.finish(name, pivot, parent)


def ell(c, radius, color):
    return ("ellipsoid", (c, radius, color, 10, 6))


def box(c, size, color):
    return ("box", (c, size, color))


def tube(a, z, radius, color, end=None):
    return ("tube", (a, z, radius, color, end, 8))


def photo(body, head, body_point, head_point):
    b.empty("PhotoBody", body_point, body)
    b.empty("PhotoHead", head_point, head)


def eyes(forms, x, y, z, radius=.025, amber=False):
    for sign in (-1, 1):
        if amber:
            forms.append(ell((sign*x, y, z), (radius*1.45, radius*1.45, radius*.65), "Amber"))
        forms.append(ell((sign*x, y, z-.005), (radius*.7 if amber else radius, radius, radius*.65), "Black"))
        forms.append(ell((sign*x-.004, y+.006, z-radius*.5-.008), (.005, .006, .003), "White"))


def four_legs(body, front, back, spread, height, color, paws, thick=.05):
    for row, z in (("F", front), ("B", back)):
        for sign, suffix in ((-1,"L"),(1,"R")):
            x = sign*spread
            piece("Leg"+row+suffix, body, (x,height,z), [
                tube((x,height,z),(x,.06,z-.015),thick,color,thick*.7),
                box((x,.035,z-.045),(thick*1.8,.07,thick*3),paws)])


def fox():
    root=b.empty("Fox")
    body=piece("Body",root,(0,.43,.05),[ell((0,.46,.04),(.18,.22,.36),"FoxRust"),
        ell((0,.49,-.22),(.16,.235,.19),"FoxGold"),ell((0,.40,-.305),(.11,.16,.07),"WarmWhite")])
    forms=[ell((0,.69,-.34),(.135,.145,.16),"FoxGold"),
           tube((0,.655,-.39),(0,.60,-.60),.09,"WarmWhite",.03),ell((0,.61,-.605),(.04,.031,.027),"Black")]
    eyes(forms,.093,.715,-.454,.021)
    head=piece("Head",body,(0,.63,-.29),forms)
    for sign,suffix in ((-1,"L"),(1,"R")):
        forms=[("prism", ([(sign*.035,.77,-.34),(sign*.135,.765,-.32),(sign*.105,.965,-.305)],(0,0,.047),"FoxRust")),
               ("prism", ([(sign*.061,.8,-.344),(sign*.114,.8,-.334),(sign*.104,.912,-.319)],(0,0,.008),"Black"))]
        piece("Ear"+suffix,head,(sign*.09,.77,-.32),forms)
    four_legs(body,-.22,.27,.115,.43,"FoxRust","Black",.045)
    piece("Tail",body,(0,.48,.35),[tube((0,.48,.35),(.08,.34,.66),.12,"FoxRust",.15),
        tube((.08,.34,.66),(.12,.20,.90),.15,"FoxGold",.10),
        tube((.12,.20,.90),(.10,.16,1.04),.10,"WarmWhite",.015)])
    photo(body,head,(0,.48,.02),(0,.7,-.37))
    return root


def squirrel():
    root=b.empty("Squirrel")
    body=piece("Body",root,(0,.22,.03),[ell((0,.245,.03),(.105,.18,.14),"SquirrelRed"),
        ell((0,.27,-.076),(.071,.12,.04),"WarmWhite")])
    forms=[ell((0,.455,-.095),(.103,.105,.108),"SquirrelRed"),
           ell((0,.405,-.18),(.055,.04,.055),"WarmWhite"),ell((0,.427,-.22),(.019,.017,.015),"Black")]
    eyes(forms,.077,.477,-.174,.018)
    head=piece("Head",body,(0,.37,-.07),forms)
    for sign,suffix in ((-1,"L"),(1,"R")):
        piece("Ear"+suffix,head,(sign*.068,.515,-.08),[
            tube((sign*.068,.51,-.08),(sign*.084,.626,-.055),.041,"Chestnut",.004)])
        piece("Forepaw"+suffix,body,(sign*.095,.32,-.065),[
            tube((sign*.095,.32,-.065),(sign*.065,.215,-.18),.027,"SquirrelRed",.021),
            ell((sign*.065,.215,-.18),(.027,.022,.045),"Chestnut")])
        piece("LegB"+suffix,body,(sign*.075,.15,.07),[
            ell((sign*.088,.13,.065),(.061,.1,.075),"SquirrelRed"),box((sign*.083,.022,-.006),(.058,.044,.14),"Chestnut")])
    piece("Tail",body,(0,.16,.16),[
        tube((0,.16,.16),(.02,.30,.33),.065,"Chestnut",.115),
        ell((.02,.41,.34),(.123,.24,.12),"SquirrelRed"),
        ell((0,.61,.23),(.12,.09,.135),"SquirrelRed"),
        ell((0,.59,.17),(.085,.06,.08),"WarmWhite")])
    photo(body,head,(0,.25,.02),(0,.455,-.105))
    return root


def rabbit():
    root=b.empty("Rabbit")
    body=piece("Body",root,(0,.2,.04),[ell((0,.24,.04),(.145,.18,.21),"RabbitTan"),ell((0,.17,-.11),(.10,.12,.10),"WarmWhite")])
    forms=[ell((0,.365,-.18),(.12,.12,.125),"RabbitTan"),ell((0,.325,-.278),(.07,.047,.035),"WarmWhite"),ell((0,.347,-.305),(.019,.016,.012),"EarPink")]
    eyes(forms,.096,.397,-.25,.019)
    head=piece("Head",body,(0,.29,-.135),forms)
    for sign,suffix in ((-1,"L"),(1,"R")):
        piece("Ear"+suffix,head,(sign*.066,.45,-.16),[
            ell((sign*.079,.59,-.145),(.042,.18,.044),"RabbitTan"),
            ell((sign*.079,.60,-.179),(.022,.14,.014),"EarPink")])
        piece("LegF"+suffix,body,(sign*.08,.22,-.10),[
            tube((sign*.08,.22,-.10),(sign*.08,.045,-.16),.034,"RabbitTan"),
            box((sign*.08,.027,-.20),(.065,.054,.14),"WarmWhite")])
        piece("LegB"+suffix,body,(sign*.10,.18,.16),[
            ell((sign*.125,.15,.155),(.073,.13,.105),"RabbitTan"),box((sign*.125,.025,.055),(.09,.05,.22),"WarmWhite")])
    piece("Tail",body,(0,.24,.25),[ell((0,.26,.29),(.073,.075,.076),"White")])
    photo(body,head,(0,.26,.04),(0,.37,-.18))
    return root


def beaver():
    root=b.empty("Beaver")
    body=piece("Body",root,(0,.26,.06),[ell((0,.30,.05),(.26,.25,.35),"BeaverBrown")])
    forms=[ell((0,.40,-.30),(.18,.15,.18),"BeaverBrown"),ell((0,.32,-.42),(.14,.082,.092),"OtterChin"),
           ell((0,.39,-.473),(.068,.044,.029),"Black"),box((-.025,.26,-.473),(.043,.065,.025),"WarmWhite"),box((.025,.26,-.473),(.043,.065,.025),"WarmWhite")]
    eyes(forms,.134,.445,-.394,.021)
    head=piece("Head",body,(0,.35,-.24),forms)
    for sign in (-1,1):
        piece("Ear"+("L" if sign<0 else "R"),head,(sign*.145,.49,-.27),[ell((sign*.148,.51,-.27),(.044,.045,.033),"TailBrown")])
    four_legs(body,-.22,.27,.19,.19,"BeaverBrown","TailBrown",.055)
    forms=[ell((0,.065,.72),(.205,.045,.36),"TailBrown")]
    for z in (.48,.59,.70,.81,.92): forms.append(tube((-.16,.102,z),(.16,.102,z+.065),.006,"BeaverBrown"))
    piece("Tail",body,(0,.16,.36),forms)
    photo(body,head,(0,.32,.04),(0,.40,-.32))
    return root


def otter():
    root=b.empty("Otter")
    body=piece("Body",root,(0,.18,.03),[ell((0,.215,.04),(.15,.155,.37),"OtterBrown")])
    forms=[ell((0,.28,-.37),(.12,.105,.15),"OtterBrown"),ell((0,.235,-.455),(.10,.055,.09),"OtterChin"),ell((0,.285,-.511),(.033,.024,.019),"Black")]
    eyes(forms,.084,.317,-.455,.017)
    for sign in (-1,1):
        forms.append(ell((sign*.102,.34,-.32),(.026,.027,.022),"TailBrown"))
        for j in range(3): forms.append(tube((sign*.055,.245+j*.012,-.49),(sign*.15,.24+j*.02,-.46),.0025,"WarmWhite"))
    head=piece("Head",body,(0,.24,-.27),forms)
    four_legs(body,-.21,.29,.115,.17,"OtterBrown","TailBrown",.034)
    piece("Tail",body,(0,.19,.36),[tube((0,.19,.36),(.015,.13,.68),.10,"OtterBrown",.065),tube((.015,.13,.68),(.025,.075,.99),.065,"OtterBrown",.008)])
    photo(body,head,(0,.22,.03),(0,.28,-.38))
    return root


def badger():
    root=b.empty("Badger")
    body=piece("Body",root,(0,.27,.06),[ell((0,.31,.05),(.23,.23,.35),"BadgerGrey"),ell((0,.34,-.2),(.20,.20,.18),"SoftGrey")])
    forms=[ell((0,.385,-.35),(.145,.13,.20),"White"),tube((0,.34,-.41),(0,.30,-.61),.094,"White",.043),ell((0,.318,-.607),(.049,.03,.029),"Black")]
    for sign in (-1,1):
        forms += [ell((sign*.096,.423,-.422),(.047,.076,.125),"Black"),ell((sign*.113,.49,-.28),(.05,.061,.04),"Black"),ell((sign*.113,.505,-.308),(.027,.033,.011),"White")]
    eyes(forms,.106,.437,-.483,.013)
    head=piece("Head",body,(0,.33,-.26),forms)
    four_legs(body,-.20,.27,.17,.25,"Black","Black",.055)
    for sign,suffix in ((-1,"L"),(1,"R")):
        leg=next(o for o in b.objects(body) if o['partName']=='LegF'+suffix)
        forms=[]
        for offset in (-.024,0,.024):forms.append(tube((sign*.17+offset,.035,-.27),(sign*.17+offset,.021,-.31),.009,"WarmWhite",.003))
        piece("Claws"+suffix,leg,(sign*.17,.035,-.27),forms)
    piece("Tail",body,(0,.3,.38),[tube((0,.3,.38),(0,.23,.58),.08,"BadgerGrey",.025)])
    photo(body,head,(0,.33,.04),(0,.40,-.38))
    return root


def bird_feet(body, spread, height, z, color, web=False):
    for sign,suffix in ((-1,"L"),(1,"R")):
        x=sign*spread
        forms=[tube((x,height,z),(x,.03,z),.016,color)]
        if web:forms.append(("prism", ([(x-.05,.012,z-.115),(x+.05,.012,z-.115),(x+.02,.012,z+.035),(x-.02,.012,z+.035)],(0,.018,0),color)))
        else:
            for dx in (-.032,0,.032): forms.append(tube((x,.015,z),(x+dx,.015,z-.075),.015,color,.007))
        piece("Foot"+suffix,body,(x,height,z),forms)


def owl():
    root=b.empty("Owl")
    body=piece("Body",root,(0,.30,.015),[ell((0,.29,.02),(.185,.245,.145),"OwlBrown"),ell((0,.30,-.10),(.135,.18,.04),"OwlGold")])
    forms=[ell((0,.575,-.025),(.20,.16,.15),"OwlBrown")]
    for sign in (-1,1):
        forms.extend([ell((sign*.086,.583,-.148),(.09,.10,.037),"OwlGold"),ell((sign*.086,.583,-.18),(.065,.075,.019),"WarmWhite")])
    eyes(forms,.083,.59,-.201,.037,True)
    forms.append(tube((0,.547,-.181),(0,.505,-.225),.026,"Beak",.001))
    for sign in (-1,1):forms.append(tube((sign*.137,.674,-.02),(sign*.19,.79,-.007),.045,"OwlBrown",.001))
    head=piece("Head",body,(0,.45,-.012),forms)
    for sign,suffix in ((-1,"L"),(1,"R")):
        forms=[ell((sign*.176,.30,.042),(.065,.215,.125),"OwlBrown")]
        for j in range(3): forms.append(ell((sign*.202,.30-j*.055,-.03),(.017,.014,.073),"OwlGold"))
        piece("Wing"+suffix,body,(sign*.15,.43,.02),forms)
    bird_feet(body,.083,.105,-.015,"Beak")
    piece("Tail",body,(0,.16,.1),[box((0,.12,.19),(.13,.045,.21),"OwlBrown")])
    photo(body,head,(0,.3,0),(0,.58,-.035))
    return root


def woodpecker():
    root=b.empty("Woodpecker")
    body=piece("Body",root,(0,.19,.02),[ell((0,.2,.02),(.073,.14,.089),"Black"),ell((0,.21,-.05),(.052,.105,.025),"WarmWhite")])
    forms=[ell((0,.365,-.038),(.074,.075,.078),"Black"),ell((0,.35,-.09),(.06,.035,.022),"White"),tube((0,.36,-.10),(0,.355,-.225),.021,"SoftGrey",.002),
           ("prism",([(-.035,.40,-.08),(-.035,.485,.002),(-.035,.40,.036)],(.07,0,0),"RedCrest"))]
    eyes(forms,.054,.386,-.099,.011)
    head=piece("Head",body,(0,.30,-.017),forms)
    for sign,suffix in ((-1,"L"),(1,"R")):
        forms=[ell((sign*.071,.20,.036),(.031,.125,.075),"Black")]
        for j in range(4): forms.append(box((sign*.094,.28-j*.044,.015),(.01,.014,.07),"White"))
        piece("Wing"+suffix,body,(sign*.065,.30,.018),forms)
    bird_feet(body,.04,.12,-.015,"SoftGrey")
    piece("Tail",body,(0,.12,.085),[("prism",([(-.052,.13,.08),(.052,.13,.08),(.035,.0,.23),(-.035,.0,.23)],(0,.012,0),"Black"))])
    b.empty("TrunkCling",(0,.09,-.08),root)
    photo(body,head,(0,.21,.015),(0,.365,-.04))
    return root


def mallard():
    root=b.empty("Mallard")
    body=piece("Body",root,(0,.22,.04),[ell((0,.25,.055),(.19,.155,.30),"DuckGrey"),ell((0,.29,-.15),(.145,.15,.15),"DuckChest")])
    forms=[tube((0,.3,-.20),(0,.49,-.22),.085,"DuckGreen",.068),ell((0,.535,-.225),(.105,.10,.115),"DuckGreen"),
           box((0,.495,-.372),(.122,.029,.155),"Beak"),ell((0,.313,-.2),(.087,.018,.087),"White")]
    eyes(forms,.085,.556,-.293,.014)
    head=piece("Head",body,(0,.30,-.2),forms)
    for sign,suffix in ((-1,"L"),(1,"R")):
        piece("Wing"+suffix,body,(sign*.145,.31,-.045),[ell((sign*.164,.28,.095),(.048,.085,.23),"DuckGrey"),box((sign*.202,.29,.11),(.017,.066,.115),"DuckBlue"),box((sign*.205,.325,.11),(.017,.015,.13),"White")])
    bird_feet(body,.075,.14,.04,"Orange",True)
    piece("Tail",body,(0,.29,.28),[tube((0,.29,.28),(0,.35,.46),.085,"Black",.01)])
    photo(body,head,(0,.26,.04),(0,.53,-.225))
    return root


PROXIES={
    "BeaverLodge":[{"min":[-1.13,0,-.8],"max":[-.43,.75,.8]}, {"min":[.43,0,-.8],"max":[1.13,.75,.8]}, {"min":[-.43,.65,-.8],"max":[.43,1.15,.8]}],
    "BadgerDen":[{"min":[-.85,0,-.48],"max":[-.31,.68,.48]}, {"min":[.31,0,-.48],"max":[.85,.68,.48]}, {"min":[-.31,.5,-.48],"max":[.31,.86,.48]}],
    "BranchPile":[], "SquirrelCache":[]}


def den(name, scale=1):
    root=b.empty(name);m=b.Mesh()
    # Three actual open tunnel sides; no dark opaque plane across the entrance.
    for sign in (-1,1):
        m.box((sign*.57*scale,.30*scale,0),(.5*scale,.60*scale,.95*scale),"Mud")
        m.ellipsoid((sign*.61*scale,.36*scale,.09*scale),(.25*scale,.37*scale,.53*scale),"Mud")
    m.box((0,.66*scale,.07*scale),(.70*scale,.25*scale,1.08*scale),"Mud")
    m.ellipsoid((0,.74*scale,.07*scale),(.62*scale,.16*scale,.50*scale),"Mud")
    if name=="BeaverLodge":
        for side in (-1,1):
            for j in range(7):
                z=(-.45+j*.15)*scale
                m.tube((side*.78*scale,.10*scale,z),(side*.22*scale,.79*scale,z+.11*scale),.05*scale,"Wood",sides=7)
        for j in range(6):
            m.tube((-.52*scale,(.80+j*.009)*scale,(-.38+j*.16)*scale),(.55*scale,.83*scale,(-.30+j*.16)*scale),.045*scale,"Bark",sides=7)
    m.finish("Shell",parent=root)
    b.empty("Entrance",(0,.22*scale,-.49*scale),root)
    b.empty("BranchWork" if name=="BeaverLodge" else "Retreat",(0,.10*scale,.40*scale),root)
    return root


def branch_pile():
    root=b.empty("BranchPile");m=b.Mesh()
    for i in range(9):
        x=(i%3-1)*.22;z=(i//3-1)*.18;y=.045+(i%3)*.065
        m.tube((x-.38,y,z-.2),(x+.39,y+.08,z+.3),.045,"Bark",.027,sides=7)
        m.tube((x,y+.04,z),(x-.16,y+.2,z+.24),.026,"Wood",.009,sides=7)
    m.finish("Branches",parent=root);b.empty("BranchGrip",(0,.20,0),root)
    # Ground the lowest vertex of the diagonal branch tubes precisely.
    ground(root)
    return root


def squirrel_cache():
    root=b.empty("SquirrelCache");m=b.Mesh()
    m.ellipsoid((0,.028,0),(.31,.028,.28),"Mud")
    for i in range(8):
        a=i*math.tau/8;x=.20*math.cos(a);z=.19*math.sin(a)
        m.prism([(x-.05,.015,z-.02),(x+.055,.02,z),(x+.015,.025,z+.06)],(0,.009,0),"Leaf" if i%2 else "LeafLight")
    for x,z in ((-.05,0),(.035,.04),(.055,-.045)):
        m.ellipsoid((x,.057,z),(.034,.039,.025),"Wood")
        m.ellipsoid((x,.087,z),(.035,.013,.027),"Bark")
    m.finish("Cache",parent=root);b.empty("Food",(0,.065,0),root)
    return root


def ground(root):
    from mathutils import Vector
    bpy=b.bpy;bpy.context.view_layer.update()
    low=min((o.matrix_world@v.co).z for o in b.objects(root) if o.type=="MESH" for v in o.data.vertices)
    if abs(low)>.000001:
        for child in root.children:child.location.z-=low
        for obj in b.objects(root):
            if obj!=root:b.PIVOTS[obj]-=Vector((0,low,0))
    bpy.context.view_layer.update()


BUILDERS={"Fox":fox,"Squirrel":squirrel,"Owl":owl,"Rabbit":rabbit,"Beaver":beaver,"Otter":otter,"Badger":badger,"Woodpecker":woodpecker,"Mallard":mallard,
          "BeaverLodge":lambda:den("BeaverLodge",1.35),"BranchPile":branch_pile,"BadgerDen":lambda:den("BadgerDen"),"SquirrelCache":squirrel_cache}

# Game-coordinate XYZ rotations, radians, for reproducible rigid-pivot inspection.
# These demonstrate available articulation; production state machines own timing.
ACTION_POSES={
    "Fox":{"Head":[-.35,0,0],"LegFL":[-.55,0,0],"LegFR":[-.55,0,0],"Tail":[.25,0,0]},
    "Rabbit":{"Head":[.22,0,0],"EarL":[-.20,0,-.15],"LegBL":[-.25,0,0]},
    "Squirrel":{"Head":[.35,0,0],"ForepawL":[-.6,0,-.3],"ForepawR":[-.6,0,.3],"Tail":[0,.25,0]},
    "Beaver":{"Head":[.25,0,0],"LegFL":[-.7,0,0],"LegFR":[-.7,0,0],"Tail":[.08,0,0]},
    "Otter":{"Head":[0,.5,0],"LegFL":[-.7,0,0],"Tail":[0,.4,0]},
    "Badger":{"Head":[.35,0,0],"LegFL":[-.6,0,0],"LegFR":[.4,0,0]},
    "Owl":{"Head":[0,.6,0],"WingL":[0,0,.75],"WingR":[0,0,-.75]},
    "Woodpecker":{"Head":[.4,0,0],"WingL":[0,0,.2],"WingR":[0,0,-.2]},
    "Mallard":{"Head":[.50,.7,0],"WingL":[0,0,.85],"WingR":[0,0,-.4]}}
