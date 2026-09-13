"""Original pixel art, rendered offline with Python's standard library.

Run: python3 scripts/generate_pixel_art.py
No canvas, asset downloads, or runtime dependencies. World units are projected
onto a 660 × 440 pixel image; the browser enlarges it with nearest-neighbor CSS.
"""
from pathlib import Path
import math
import random
import struct
import zlib

OUT = Path(__file__).resolve().parents[1] / 'public' / 'art'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(217)
W, H = 660, 440
pixels = bytearray(W * H * 4)


def rgb(color):
    return tuple(bytes.fromhex(color.removeprefix('#'))) + (255,)


def dot(x, y, color):
    x, y = int(x), int(y)
    if 0 <= x < W and 0 <= y < H:
        pixels[(y * W + x) * 4:(y * W + x) * 4 + 4] = bytes(rgb(color))


def rect(x, y, w, h, color):
    for yy in range(int(y), int(y + h)):
        for xx in range(int(x), int(x + w)):
            dot(xx, yy, color)


def line(a, b, color, width=1):
    x, y = a; dx, dy = b[0] - x, b[1] - y
    n = max(abs(int(dx)), abs(int(dy)), 1)
    for i in range(n + 1):
        rect(round(x + dx * i / n), round(y + dy * i / n), width, width, color)


def poly(points, color):
    for y in range(max(0, int(min(p[1] for p in points))), min(H, math.ceil(max(p[1] for p in points)) + 1)):
        crossings = []
        for i, (x1, y1) in enumerate(points):
            x2, y2 = points[(i + 1) % len(points)]
            if (y1 <= y < y2) or (y2 <= y < y1):
                crossings.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        crossings.sort()
        for i in range(0, len(crossings) - 1, 2):
            rect(math.ceil(crossings[i]), y, int(crossings[i + 1]) - math.ceil(crossings[i]) + 1, 1, color)


def p(x, y, z=0):
    return (300 + (x - y) * .85, 120 + (x + y) * .43 - z)


def plane(coords, color):
    poly([p(*c) for c in coords], color)


def block(x, y, w, d, h, top='#ad9570', left='#645d50', right='#7a6c56', base=0):
    plane([(x,y,base+h),(x+w,y,base+h),(x+w,y+d,base+h),(x,y+d,base+h)],top)
    plane([(x,y+d,base),(x+w,y+d,base),(x+w,y+d,base+h),(x,y+d,base+h)],left)
    plane([(x+w,y,base),(x+w,y+d,base),(x+w,y+d,base+h),(x+w,y,base+h)],right)


def light_and_texture():
    """Quantized light pools and sparse grain keep all shading on the pixel grid."""
    for y in range(H):
        for x in range(W):
            i = (y * W + x) * 4
            r, g, b, alpha = pixels[i:i+4]
            if not alpha or r < 60 or g < 55:
                continue
            warm = math.exp(-((x-185)**2 + (y-210)**2) / 14000)
            cool = math.exp(-((x-389)**2 + (y-177)**2) / 6000)
            gain = round((.79 + .28 * warm + .13 * cool) * 14) / 14
            grain = random.choice([-4, 0, 0, 0, 0, 3])
            channels = (r * gain + 10 * warm - 9 * cool,
                        g * gain + 4 * warm + 5 * cool,
                        b * gain - 3 * warm + 15 * cool)
            for channel, value in enumerate(channels):
                pixels[i+channel] = max(0, min(255, int(value + grain)))


def save(name):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    scan = b''.join(b'\x00' + pixels[y * W * 4:(y + 1) * W * 4] for y in range(H))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', W,H,8,6,0,0,0)) + chunk(b'IDAT',zlib.compress(scan,9)) + chunk(b'IEND',b'')
    (OUT / name).write_bytes(png)


# Cold city and wet pavement. All texture is seeded and fixed between builds.
rect(0,0,W,H,'#101e32')
for i in range(1800):
    x=random.randrange(W); y=random.randrange(H)
    rect(x,y,random.choice([1,2,4]),1,random.choice(['#152439','#192b40','#203047']))
for x,y,w,h in [(0,10,96,154),(112,0,62,135),(183,0,59,84),(448,0,91,144),(562,15,98,177)]:
    rect(x,y,w,h,'#112035')
    for yy in range(y+7,y+h,14):
        for xx in range(x+7,x+w-4,10):
            rect(xx,yy,3,5,random.choice(['#1e3045','#1e3045','#1e3045','#796a56','#384453']))
# A street behind the glass, with broken reflected light.
for i in range(220):
    x=random.randrange(450,660); y=random.randrange(120,400)
    rect(x,y,random.randrange(2,12),1,random.choice(['#31495b','#253d53','#45606a','#6d6959']))
for x,y in [(602,106),(91,165)]:
    rect(x,y,3,73,'#0d1728');rect(x-5,y,13,4,'#192637')
    rect(x-3,y+4,9,3,'#d8b07a');rect(x-2,y+7,7,2,'#8b795d')
for i in range(110):
    x=random.randrange(W); y=random.randrange(H)
    line((x,y),(x-2,y+random.randrange(3,8)),random.choice(['#294059','#37536a','#263b53']))
# Raised foundation and diamond tiled floor.
block(0,0,360,300,8,'#8d8067','#354355','#354151',base=-8)
for x in range(0,360,20):
    for y in range(0,300,20):
        c=random.choice(['#a08e70','#ac9675','#a59170','#b09a78','#9b8b72'])
        plane([(x,y,0),(x+19,y,0),(x+19,y+19,0),(x,y+19,0)],c)
        line(p(x,y),p(x+19,y),'#c0a987')
        if random.random()<.45:
            px,py=p(x+8,y+6);rect(px,py,2,1,'#c3ae8b')
# Back walls: left plaster with brick detail; right large street-facing glass.
plane([(0,0,0),(0,300,0),(0,300,108),(0,0,108)],'#8a806c')
for y in range(0,300,20):
    for z in range(0,108,9):
        offset=8 if (z//9)%2 else 0
        line(p(0,y+offset,z),p(0,min(y+offset+18,300),z),'#968b75')
        line(p(0,y+offset,z),p(0,y+offset,z+7),'#746e61')
plane([(0,0,0),(360,0,0),(360,0,108),(0,0,108)],'#273b4b')
for x in range(0,360,40):
    plane([(x+3,0,6),(x+37,0,6),(x+37,0,104),(x+3,0,104)],'#23374c')
    for _ in range(20):
        rx=random.randrange(x+4,x+35); rz=random.randrange(7,100)
        line(p(rx,0,rz),p(rx,0,rz-4),random.choice(['#3b5569','#456078','#30475b']))
    plane([(x,0,0),(x+3,0,0),(x+3,0,108),(x,0,108)],'#15283b')
    line(p(x+4,0,103),p(x+4,0,8),'#687776')
line(p(0,0,106),p(360,0,106),'#747b75',3)
line(p(0,0,108),p(0,300,108),'#b09b7e',4)
line(p(0,0,0),p(0,300,0),'#4d5452',5)
# Warm and cool stepped light reflections across the floor.
for x in range(150,350,20):
    for y in range(22,110,14):
        if random.random()<.6:
            line(p(x,y),p(x+random.randrange(4,16),y),'#b6ad8f')
# Left wall stock shelves, seen along the wall plane.
product_colors=['#b36c48','#a99356','#667e71','#c39f68','#c2b18b','#78594e','#8b977d']
for z in [23,44,65]:
    block(3,90,16,156,3,'#b09d79','#514f47','#665c4c',base=z)
    for y in range(94,240,9):
        block(6,y,8,6,random.choice([10,12,14]),random.choice(product_colors),'#665949',random.choice(product_colors),base=z+3)
        a=p(14,y+1,z+9);b=p(14,y+5,z+9);line(a,b,'#ddc294',2)
# Fridges against back right wall: four stocked doors, bright pixel strips.
for x in range(34,194,40):
    block(x,3,37,19,78,'#647e85','#263f52','#374a57')
    plane([(x+3,23,5),(x+34,23,5),(x+34,23,74),(x+3,23,74)],'#446675')
    for z in [10,25,40,55]:
        for xx in range(x+6,x+32,6):
            block(xx,19,4,3,10,'#b8d2be','#87b8bb',random.choice(['#c5ad7d','#a9c6b7','#7499ac','#ae8d75']),base=z)
            line(p(xx,23,z+4),p(xx+3,23,z+4),'#d4d9bc',2)
        line(p(x+3,24,z-1),p(x+34,24,z-1),'#a6c6bd',2)
    line(p(x+3,24,4),p(x+3,24,74),'#bce5d8',2)
    line(p(x+34,24,4),p(x+34,24,74),'#9fc4c9',2)
    line(p(x+30,25,31),p(x+30,25,43),'#e3d9b5',2)
    line(p(x+6,24,67),p(x+16,24,60),'#83aeb2')
# Original store fascia above the fridge row.
block(28,1,173,22,15,'#b09b7f','#4e8192','#6f877f',base=80)
line(p(28,24,92),p(201,24,92),'#dbab75',3)
line(p(28,24,82),p(201,24,82),'#d7c2a0',2)
# Glass entry at right, including handle, lintel and welcome mat.
for x in [278,338]:
    line(p(x,1,1),p(x,1,101),'#122338',4)
line(p(278,1,100),p(341,1,100),'#65716f',4)
line(p(280,2,8),p(339,2,8),'#78817a',2)
line(p(332,3,36),p(332,3,57),'#b6a68d',2)
line(p(326,3,36),p(332,3,36),'#b6a68d',2)
plane([(275,14,1),(337,14,1),(337,45,1),(275,45,1)],'#4b5352')
for y in range(18,42,4):line(p(280,y,1),p(332,y,1),'#62685f')
# Low back coffee bench, equipment and posters.
block(7,160,24,95,30,'#b79a6c','#514d43','#635747')
block(10,177,18,19,24,'#a2987b','#273b3c','#4d5550',base=30)
block(11,179,12,13,13,'#9e9174','#795d41','#303a39',base=34)
block(10,223,15,15,21,'#897d64','#313c3b','#454d43',base=30)
for y in [210,216]:block(19,y,5,4,7,'#e0c598','#b09b76','#ccb089',base=30)
# Warm overhead strips, wall glow made of hard-edged pixel bands.
for y0,y1 in [(85,155),(178,245)]:
    for dz,c in [(0,'#b99c68'),(2,'#d3ae71'),(4,'#ffe1a0')]:
        line(p(16,y0,79+dz),p(16,y1,79+dz),c,2)
# Island shelves: sturdy raised volumes with several independently stocked rows.
def shelf(x,y,w,d,h):
    # Drop shadow falls across the floor, not a floating CSS card shadow.
    plane([(x+9,y+8,0),(x+w+15,y+8,0),(x+w+15,y+d+13,0),(x+9,y+d+13,0)],'#746d5c')
    block(x,y,w,d,h,'#a8997e','#444f50','#5f6256')
    for z in [4,19,34]:
        for xx in range(x+4,x+w-5,8):
            color=random.choice(product_colors)
            plane([(xx,y+d+1,z+2),(xx+6,y+d+1,z+2),(xx+6,y+d+1,z+12),(xx,y+d+1,z+12)],color)
            line(p(xx+1,y+d+2,z+7),p(xx+4,y+d+2,z+7),'#ddc79a',2)
        line(p(x,y+d+2,z),p(x+w,y+d+2,z),'#bca982',2)
    for xx in range(x+3,x+w-4,10):
        for yy in range(y+3,y+d-3,9):
            c=random.choice(product_colors)
            block(xx,yy,7,6,7,c,'#725943',c,base=h)
            line(p(xx+2,yy+6,h+4),p(xx+5,yy+6,h+4),'#efd1a0')
    for zz in [10,28]:
        plane([(x+w+1,y+4,zz),(x+w+1,y+d-4,zz),(x+w+1,y+d-4,zz+8),(x+w+1,y+4,zz+8)],'#9e9175')
    line(p(x,y+d,0),p(x,y+d,h),'#c0ac8c',2)
    line(p(x+w,y+d,0),p(x+w,y+d,h),'#b6a081',2)

shelf(155,113,109,29,45)
shelf(193,211,112,30,43)
shelf(305,109,30,37,40)
# Cardboard boxes and a potted plant near the entrance.
block(250,12,19,17,20,'#bfa077','#806c51','#9b805b')
line(p(260,12,20),p(260,29,20),'#d5b885',2)
block(253,48,14,14,15,'#9c7960','#5c5149','#765c4e')
for _ in range(35):
    px,py=p(259+random.randrange(-13,14),54+random.randrange(-8,9),random.randrange(17,37))
    rect(px,py,random.randrange(2,5),3,random.choice(['#42554a','#596b50','#778360','#8a9063']))
# Foreground freezer, bringing the scene out toward the viewer.
block(55,264,80,30,30,'#a2aba0','#465c63','#66766e')
plane([(60,267,31),(130,267,31),(130,289,31),(60,289,31)],'#4b7179')
for _ in range(55):
    x=random.randrange(62,126);y=random.randrange(269,287)
    block(x,y,3,3,1,random.choice(['#bfa97c','#8daea3','#c9bdb1']),base=31)
line(p(96,267,32),p(96,289,32),'#d2c9a8',2)
# Pixel litter, floor reflections and a quiet pool of warm light.
for _ in range(120):
    x=random.randrange(25,150);y=random.randrange(90,250)
    if x>120:
        px,py=p(x,y);rect(px,py,2,1,random.choice(['#c5b08a','#8f826b']))
# Two pendant lights hang from the removed ceiling of the cutaway view.
for x,y in [(197,103),(362,139)]:
    line((x,y-37),(x,y),'#29333b',2)
    poly([(x-10,y+4),(x-6,y),(x+6,y),(x+10,y+4)],'#554f45')
    rect(x-10,y+4,21,3,'#bd965c')
    rect(x-8,y+7,17,2,'#ffe3a1')
    rect(x-5,y+9,11,1,'#d9b378')
light_and_texture()
save('store.png')

# A separate counter foreground allows Kai to stand behind it in DOM layers.
pixels[:] = bytes(W*H*4)
block(65,139,32,106,36,'#d3b07b','#685f50','#776348')
block(62,136,38,113,5,'#e6c492','#a78d62','#b09a71',base=36)
for y in range(141,242,24):
    line(p(98,y,2),p(98,y,33),'#494e48')
    plane([(99,y+3,8),(99,y+18,8),(99,y+18,24),(99,y+3,24)],'#b49c77')
    line(p(100,y+5,18),p(100,y+14,18),'#676556',2)
block(76,163,16,20,6,'#344348','#202e36','#405152',base=41)
block(78,164,5,15,16,'#6e817b','#253a40','#5b7777',base=47)
block(76,219,16,16,5,'#6d5e49','#3b3e38','#5b5140',base=41)
for y in [190,199,205]:block(73,y,9,5,10,'#d6b97f','#ab7950','#be945b',base=41)
light_and_texture()
save('counter.png')

# Pixel sprites are editable character maps, with transparent cells marked '.'.
PALETTE = {'o':'#202b36','h':'#302b32','H':'#514049','s':'#d5a77b','S':'#b77d61','e':'#202c34','w':'#d5c9a6','b':'#536d83','B':'#354757','a':'#a69770','A':'#c9b68a','l':'#343c4b','f':'#202b36','c':'#d9c5a0','C':'#96745d','t':'#4e4140'}
KAI = [
'......oooooo......','....oohhhhhhoo....','...ohhHHhhhhhho...','...ohHHhhhhhhho...','...ohhsssssssho...','....osesssesso....','....osssssssSo....','.....osSSSSo......','....obwwwwbbo.....','...obbwaAwbbbo....','...obbaAAAabbo....','...osbaAAAabso....','...osbaaaaabso....','...osbaAAaabso....','...oSbAAAAabSo....','....obaaaaabo.....','.....ollllo.......','.....oloolo.......','.....ol..lo.......','....off..ffo......']
MIRA = [
'......oooooo......','....oohhHHhhoo....','...ohhHHHhhhho....','...ohHHhhhhhhho...','...ohhssssshhho...','...ohsessseShho...','...ohssssssShho...','...ohhSSSSShhho...','....ohwbbwbhho....','...oBbwbbwbBBo....','...oBbwbbwbBBo....','...osbbbbbbBBo....','...osbBbbbBBso....','...osbBbbbBBso....','...oSBBBBBBBSo....','....oBBBBBBBo.....','.....ollllo.......','.....oloolo.......','.....ol..lo.......','....off..ffo......']
CAT = [
'...............o...o....','..............oCo.oCo...','..............oCCoCCo...','....ooooooo...oCcccCo...','..ooCCCCCCCo..occccCo...','.otCCCCcccccooccececo...','otCCCcccccccccoccccCo...','otCCcccccccccccoCCCo....','.ooCccccccccccccooo.....','...ooocccooocccoo.......','.....oooo...oooo........']
for name, rows in [('kai',KAI),('mira',MIRA),('cat',CAT)]:
    W,H=max(map(len,rows)),len(rows)
    pixels=bytearray(W*H*4)
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c!='.':dot(x,y,PALETTE[c])
    save(name+'.png')
print('Generated store, counter, and three original pixel sprites in public/art.')
