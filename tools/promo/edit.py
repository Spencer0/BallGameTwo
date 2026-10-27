"""Cut the captured clips to the voiceover, burn in subtitles and mix voice, game sounds and music.
python3 tools/promo/edit.py <promoDir>
expects frames/<shot>/ + frames/<shot>.wav, music.wav, vo.mp3 and Shrikhand.ttf in promoDir."""
import os, subprocess, sys

D = sys.argv[1]
FPS = 30
END = 20.5
# the ending: v1's city pull-back, played a little faster to fit (8.6 s of footage)
PULLBACK = os.path.join(D, '..', 'promo', 'frames', '10_city_pullback')
# shot -> slot on the timeline (s); cuts sit in the pauses between voiceover lines
SLOTS = [
    ('01_desk_low', 0.0, 2.12), ('02_desk_orbit', 2.12, 3.67), ('03_bedroom_title', 3.67, 5.86),
    ('04_house_orbit', 5.86, 8.2), ('05_suburb_low', 8.2, 10.4), ('06_town_chase', 10.4, 12.7),
    ('07_city_low', 12.7, 15.15), ('08_city_pullback', 15.15, END),
]
SUBS = [  # spoken words, plain subtitles low-centre like a dev's own TikTok
    ("I'm finally about to release my new game", 0.05, 2.0), ("I've been building it for a while", 2.2, 3.6),
    ("It's called", 3.9, 5.75), ("I've always wanted to make a game like this", 6.0, 9.8),
    ('where you can hoover up everything around you', 10.05, 12.6), ('and it just keeps escalating', 12.6, 14.95),
    ("preview link's in the comments", 15.3, 16.6), ('let me know what you guys think', 16.9, END),
]
TITLE = ('LINT ROLLER', 4.35, 5.8)
SANS = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'

os.makedirs(f'{D}/seg', exist_ok=True)
segs = []
for name, a, b in SLOTS:
    src, rate = f'{D}/frames/{name}', FPS
    if name == '08_city_pullback' and os.path.isdir(PULLBACK):
        src, rate = PULLBACK, round(FPS * 8.6 / (b - a), 3)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(rate), '-i', f'{src}/%05d.jpg', '-i', f'{D}/frames/{name}.wav',
                    '-t', f'{b - a:.3f}', '-vf', 'scale=1080:1920,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-r', str(FPS),
                    '-c:a', 'pcm_s16le', '-af', 'afade=t=out:st=%.3f:d=0.08' % (b - a - 0.08), f'{D}/seg/{name}.mov'], check=True)
    segs.append(f'{D}/seg/{name}.mov')
with open(f'{D}/seg/list.txt', 'w') as f:
    f.writelines(f"file '{s}'\n" for s in segs)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{D}/seg/list.txt', '-c', 'copy', f'{D}/clips_only.mov'], check=True)

def esc(t):
    return t.replace('\\', '\\\\').replace("'", "’").replace(':', '\\:').replace('%', '\\%')
def wrap(t, n=24):
    # two balanced lines for anything longer than n characters
    if len(t) <= n:
        return [t]
    words, best = t.split(), None
    for i in range(1, len(t.split())):
        a, b = ' '.join(words[:i]), ' '.join(words[i:])
        if best is None or max(len(a), len(b)) < max(len(best[0]), len(best[1])):
            best = (a, b)
    return list(best)
draws = [
    f"drawtext=fontfile={SANS}:text='{esc(line)}':fontsize=62:fontcolor=white:borderw=6:bordercolor=black@0.85:"
    f"x=(w-text_w)/2:y=h*0.68+{k * 78}:enable='between(t,{a},{b})'"
    for t, a, b in SUBS for k, line in enumerate(wrap(t))
]
t, a, b = TITLE
draws.append(f"drawtext=fontfile={D}/Shrikhand.ttf:text='{t}':fontsize=124:fontcolor=white:borderw=11:bordercolor=0x2a1e3f:"
             f"x=(w-text_w)/2:y=h*0.22:enable='between(t,{a},{b})'")
# voice on top; the game's own sounds under it; the music bed low, out at the end
mix = (f"[0:v]{','.join(draws)}[v];"
       f"[0:a]volume=2.2[sfx];[1:a]volume=1.0,apad[vo];[2:a]volume=0.22,afade=t=out:st={END - 1.2}:d=1.2[mus];"
       f"[vo][sfx][mus]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95[a]")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{D}/clips_only.mov', '-i', f'{D}/vo.mp3', '-i', f'{D}/music.wav',
                '-filter_complex', mix, '-map', '[v]', '-map', '[a]', '-t', str(END), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', f'{D}/lint_roller_promo.mp4'], check=True)
print('ok', f'{D}/lint_roller_promo.mp4')
