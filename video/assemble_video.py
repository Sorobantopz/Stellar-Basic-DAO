#!/usr/bin/env python3
"""
Stellar Basic DAO Pitch Video Assembler v2.
Uses concat demuxer (works with older ffmpeg without xfade).
"""
import os, subprocess, wave, re

FFMPEG  = "/usr/local/share/npm-global/lib/node_modules/@ffmpeg-installer/ffmpeg/node_modules/@ffmpeg-installer/linux-x64/ffmpeg"
FRAMES  = "/workspaces/Stellar-Basic-DAO/video/frames"
AUDIO   = "/workspaces/Stellar-Basic-DAO/video/audio"
FINAL   = "/workspaces/Stellar-Basic-DAO/video/final"
os.makedirs(FINAL, exist_ok=True)

SLIDES = [
    "01_title", "02_problem", "03_solution", "04_live_demo",
    "05_contracts", "06_architecture", "07_features",
    "08_why_stellar", "09_traction", "10_cta",
]

def get_wav_duration(path: str) -> float:
    try:
        with wave.open(path, "rb") as wf:
            return wf.getnframes() / wf.getframerate()
    except:
        return 12.0

def ffmpeg_duration(path: str) -> float:
    r = subprocess.run(f'{FFMPEG} -i "{path}" -f null /dev/null 2>&1',
                       shell=True, capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    if m:
        h, m2, s = m.groups()
        return float(h)*3600 + float(m2)*60 + float(s)
    return 12.0

def run(cmd, desc=""):
    print(f"  ▸ {desc}...")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ✗ {r.stderr[-400:]}")
        raise RuntimeError(f"Failed: {desc}")
    return r

def make_slide_video(slide_id, img, audio, out, dur):
    """Encode one slide: image + audio, with Ken-Burns zoom + fade in/out."""
    total = dur + 0.5
    fps = 25
    nframes = int(total * fps)
    zoom_expr = "min(zoom+0.00008,1.05)"
    vf = (
        f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={nframes}:s=1920x1080:fps={fps},"
        f"fade=in:st=0:d=0.4,"
        f"fade=out:st={total-0.5:.2f}:d=0.5"
    )
    af = f"afade=t=in:st=0:d=0.3,afade=t=out:st={total-0.5:.2f}:d=0.5"
    cmd = (
        f'{FFMPEG} -y '
        f'-loop 1 -framerate {fps} -i "{img}" '
        f'-i "{audio}" '
        f'-vf "{vf}" '
        f'-af "{af}" '
        f'-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p '
        f'-c:a aac -b:a 128k -ar 24000 '
        f'-t {total:.3f} '
        f'"{out}"'
    )
    run(cmd, f"Encode {slide_id} ({dur:.1f}s)")

def concat_with_list(video_paths, out):
    """Concat using concat demuxer — zero re-encode, fast."""
    list_file = os.path.join(FINAL, "concat_list.txt")
    with open(list_file, "w") as f:
        for p in video_paths:
            f.write(f"file '{p}'\n")
    cmd = (
        f'{FFMPEG} -y '
        f'-f concat -safe 0 -i "{list_file}" '
        f'-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p '
        f'-c:a aac -b:a 128k '
        f'"{out}"'
    )
    run(cmd, "Concatenate all slides")

def add_global_fades(inp, out):
    """Apply global fade-in at start and fade-out at end."""
    total = ffmpeg_duration(inp)
    fade_out_start = max(0, total - 1.5)
    vf = f"fade=in:st=0:d=0.8,fade=out:st={fade_out_start:.2f}:d=1.5"
    af = f"afade=t=in:st=0:d=0.8,afade=t=out:st={fade_out_start:.2f}:d=1.5"
    cmd = (
        f'{FFMPEG} -y -i "{inp}" '
        f'-vf "{vf}" -af "{af}" '
        f'-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p '
        f'-c:a aac -b:a 128k '
        f'"{out}"'
    )
    run(cmd, f"Add global fades (total {total:.1f}s)")
    return total

if __name__ == "__main__":
    print("=" * 62)
    print("  Stellar Basic DAO — Pitch Video Assembly")
    print("=" * 62)

    print("\n[1/3] Encoding individual slide videos with Ken-Burns zoom...")
    slide_videos = []
    for sid in SLIDES:
        img   = os.path.join(FRAMES, f"{sid}.png")
        audio = os.path.join(AUDIO,  f"{sid}.wav")
        out   = os.path.join(FINAL,  f"slide_{sid}.mp4")
        if not os.path.exists(img):   print(f"  ✗ Missing: {img}"); continue
        if not os.path.exists(audio): print(f"  ✗ Missing: {audio}"); continue
        dur = get_wav_duration(audio)
        make_slide_video(sid, img, audio, out, dur)
        slide_videos.append(out)
    print(f"\n  ✓ {len(slide_videos)} slide videos encoded")

    print("\n[2/3] Concatenating slides...")
    concat_out = os.path.join(FINAL, "pitch_raw.mp4")
    concat_with_list(slide_videos, concat_out)

    print("\n[3/3] Adding global fade in/out...")
    final_out = os.path.join(FINAL, "stellar_basic_dao_pitch.mp4")
    total = add_global_fades(concat_out, final_out)

    size_mb = os.path.getsize(final_out) / 1024 / 1024
    print(f"\n{'='*62}")
    print(f"  ✅  FINAL VIDEO READY")
    print(f"      File    : {final_out}")
    print(f"      Duration: {total:.0f}s  ({total/60:.1f} min)")
    print(f"      Size    : {size_mb:.1f} MB")
    print(f"      Codec   : H.264 / AAC  1920×1080")
    print(f"{'='*62}")
