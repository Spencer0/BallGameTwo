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
    ('01_desk_low', 0.0, 2.15), ('02_desk_orbit', 2.15, 3.75), ('02b_desk_clean', 3.75, 9.85),
    # "However, the dust bunny gets drunk with power and takes things a little too far": a world a second
    ('03_bedroom_title', 9.85, 10.95), ('04_house_orbit', 10.95, 12.0), ('05_suburb_low', 12.0, 13.05),
    ('06_town_chase', 13.05, 14.1), ('07_city_low', 14.1, 15.2), ('08_city_pullback', 15.2, END),
]
SUBS = [  # the words as spoken (transcribed with word timings), plain subtitles low-centre
    ('Check out my new game', 0.0, 0.9), ("I'm about to release", 0.9, 2.15), ("It's called", 2.3, 3.75),
    ('The premise is straightforward', 3.96, 5.7), ('A family hires a dust bunny', 6.02, 7.6),
    ('to roll the ball of lint to clean the table', 7.6, 9.85), ('However,', 10.14, 10.95),
    ('the dust bunny gets drunk with power', 10.98, 12.8), ('and takes things a little too far', 12.8, 15.1),
    ("Preview link's in the comments", 15.5, 16.9), ('Let me know what you guys think', 16.98, END),
]
TITLE = ('LINT ROLLER', 2.64, 3.9)
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
       f"[0:a]volume=0.9[sfx];[1:a]volume=1.0,apad[vo];[2:a]volume=0.22,afade=t=out:st={END - 1.2}:d=1.2[mus];"
       f"[vo][sfx][mus]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95[a]")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{D}/clips_only.mov', '-i', f'{D}/vo.mp3', '-i', f'{D}/music.wav',
                '-filter_complex', mix, '-map', '[v]', '-map', '[a]', '-t', str(END), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', f'{D}/lint_roller_promo.mp4'], check=True)
print('ok', f'{D}/lint_roller_promo.mp4')
