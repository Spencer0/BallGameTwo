"""Cut the captured frames to the voiceover and burn in captions.
python3 tools/promo/edit.py <promoDir>   (expects frames/<shot>/, vo.mp3, Shrikhand.ttf in promoDir)"""
import os, subprocess, sys

D = sys.argv[1]
FPS = 30
# shot -> slot on the timeline (s); cut points sit in the pauses between voiceover lines
SLOTS = [
    ('01_hook_city', 0.0, 3.77), ('02_title_desk', 3.77, 5.92), ('03_desk_roll', 5.92, 8.49),
    ('04_desk_grow', 8.49, 11.73), ('05_house', 11.73, 13.53), ('06_park', 13.53, 14.78),
    ('07_suburb', 14.78, 17.52), ('08_town', 17.52, 19.96), ('09_city_street', 19.96, 22.0),
    ('10_city_pullback', 22.0, 30.2),
]
CAPS = [  # text, start, end, size, y (fraction of height)
    ("I'm thinking about", 0.15, 3.65, 74, 0.20), ('launching my game...', 0.15, 3.65, 74, 0.25),
    ('LINT ROLLER', 3.9, 5.85, 150, 0.22),
    ('a game about cleaning...', 6.1, 8.4, 70, 0.20), ('gone wrong', 7.2, 8.4, 92, 0.255),
    ('a tiny dust bunny', 8.6, 11.6, 70, 0.20), ('cleans ONE table...', 8.6, 11.6, 70, 0.25),
    ('farther...', 11.9, 13.45, 96, 0.22), ('farther...', 13.85, 14.75, 110, 0.22),
    ('FARTHER...', 15.0, 17.45, 130, 0.22), ('and FARTHER!', 17.8, 19.9, 140, 0.22),
    ('should I release it?', 20.2, 21.95, 80, 0.22),
    ('Play the preview', 22.0, 30.2, 86, 0.20), ('in the comments!', 22.0, 30.2, 86, 0.255),
]
os.makedirs(f'{D}/seg', exist_ok=True)
segs = []
for name, a, b in SLOTS:
    out = f'{D}/seg/{name}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{D}/frames/{name}/%05d.jpg',
                    '-t', f'{b - a:.3f}', '-vf', 'scale=1080:1920,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-r', str(FPS), out], check=True)
    segs.append(out)
with open(f'{D}/seg/list.txt', 'w') as f:
    f.writelines(f"file '{s}'\n" for s in segs)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{D}/seg/list.txt', '-c', 'copy', f'{D}/clips_only.mp4'], check=True)

font = f'{D}/Shrikhand.ttf'
def esc(t):
    return t.replace('\\', '\\\\').replace("'", "’").replace(':', '\\:').replace('%', '\\%')
draws = [
    f"drawtext=fontfile={font}:text='{esc(t)}':fontsize={s}:fontcolor=white:borderw={max(6, s // 11)}:bordercolor=0x2a1e3f:"
    f"x=(w-text_w)/2:y=h*{y}-text_h/2:enable='between(t,{a},{b})'"
    for t, a, b, s, y in CAPS
]
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{D}/clips_only.mp4', '-i', f'{D}/vo.mp3',
                '-filter_complex', f"[0:v]{','.join(draws)}[v];[1:a]apad=pad_dur=1.0,afade=t=out:st=29.4:d=0.8[a]",
                '-map', '[v]', '-map', '[a]', '-t', '30.2', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', f'{D}/lint_roller_promo.mp4'], check=True)
print('ok', f'{D}/lint_roller_promo.mp4')
