#!/usr/bin/env python3
import struct, sys, zlib
from pathlib import Path

PNG_SIG = b'\x89PNG\r\n\x1a\n'

def read_png(path):
    data = Path(path).read_bytes()
    if not data.startswith(PNG_SIG):
        raise SystemExit('not png')
    pos = 8
    chunks = []
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        chunks.append((typ, chunk))
        pos += 12 + ln
    ihdr = next(c for t,c in chunks if t == b'IHDR')
    w,h,bit,color,comp,flt,interlace = struct.unpack('>IIBBBBB', ihdr)
    if bit != 8 or interlace != 0 or color not in (2,6):
        raise SystemExit(f'unsupported png bit={bit} color={color} interlace={interlace}')
    raw = zlib.decompress(b''.join(c for t,c in chunks if t == b'IDAT'))
    bpp = 3 if color == 2 else 4
    rows = []
    i = 0
    prev = bytearray(w*bpp)
    for _ in range(h):
        f = raw[i]; i += 1
        scan = bytearray(raw[i:i+w*bpp]); i += w*bpp
        recon = bytearray(len(scan))
        for x, val in enumerate(scan):
            a = recon[x-bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x-bpp] if x >= bpp else 0
            if f == 0: p = val
            elif f == 1: p = (val + a) & 255
            elif f == 2: p = (val + b) & 255
            elif f == 3: p = (val + ((a+b)//2)) & 255
            elif f == 4:
                pr = a + b - c
                pa, pb, pc = abs(pr-a), abs(pr-b), abs(pr-c)
                pred = a if pa <= pb and pa <= pc else b if pb <= pc else c
                p = (val + pred) & 255
            else: raise SystemExit('bad filter')
            recon[x] = p
        rows.append(recon)
        prev = recon
    return w,h,color,rows

def chunk(typ, data):
    return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ+data)&0xffffffff)

def write_png(path, w, h, rgba_rows):
    ihdr = struct.pack('>IIBBBBB', w,h,8,6,0,0,0)
    raw = b''.join(b'\x00' + bytes(row) for row in rgba_rows)
    data = PNG_SIG + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    Path(path).write_bytes(data)

def bg_alpha(r,g,b):
    # Remove white/off-white JPEG background with soft edges; keep the light gray CAST BUILD mark.
    mn = min(r,g,b); mx = max(r,g,b); chroma = mx - mn
    if mn >= 252 and chroma <= 8: return 0
    if mn >= 245 and chroma <= 14: return int((252 - mn) / 7 * 80)
    if mn >= 235 and chroma <= 22: return int(80 + (245 - mn) / 10 * 150)
    return 255

def main():
    src, dst = sys.argv[1], sys.argv[2]
    w,h,color,rows = read_png(src)
    out = []
    for row in rows:
        nr = bytearray()
        step = 3 if color == 2 else 4
        for i in range(0, len(row), step):
            r,g,b = row[i], row[i+1], row[i+2]
            a = row[i+3] if color == 6 else 255
            na = min(a, bg_alpha(r,g,b))
            nr.extend([r,g,b,na])
        out.append(nr)
    write_png(dst, w,h,out)

if __name__ == '__main__': main()
