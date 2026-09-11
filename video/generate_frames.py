#!/usr/bin/env python3
"""
Stellar Basic DAO — Pitch Video Frame Generator
Produces 1920x1080 PNG frames for each slide using Pillow + ImageMagick.
"""
from PIL import Image, ImageDraw, ImageFont
import os, textwrap, math

W, H = 1920, 1080
OUT = "/workspaces/Stellar-Basic-DAO/video/frames"
os.makedirs(OUT, exist_ok=True)

# ── Colour palette ────────────────────────────────────────────────────────────
BG_DARK      = (8,   8,  20)       # near-black
BG_CARD      = (18,  18,  40)       # card bg
INDIGO       = (99, 102, 241)       # primary accent
PURPLE       = (168,  85, 247)      # secondary accent
VIOLET       = (139,  92, 246)
CYAN         = ( 34, 211, 238)
EMERALD      = ( 52, 211, 153)
AMBER        = (251, 191,  36)
WHITE        = (255, 255, 255)
GREY         = (156, 163, 175)
DARK_GREY    = ( 55,  65,  81)

# ── Font helper ───────────────────────────────────────────────────────────────
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
    except:
        return ImageFont.load_default()

MONO_DIR = "/usr/share/fonts/truetype/dejavu"
def mono(size):
    try:
        return ImageFont.truetype(os.path.join(MONO_DIR, "DejaVuSansMono-Bold.ttf"), size)
    except:
        return ImageFont.load_default()

# ── Drawing helpers ───────────────────────────────────────────────────────────
def gradient_bg(draw, w, h, c1=BG_DARK, c2=(14, 10, 35)):
    """Vertical gradient background."""
    for y in range(h):
        t = y / h
        r = int(c1[0] + t*(c2[0]-c1[0]))
        g = int(c1[1] + t*(c2[1]-c1[1]))
        b = int(c1[2] + t*(c2[2]-c1[2]))
        draw.line([(0,y),(w,y)], fill=(r,g,b))

def glow_circle(draw, cx, cy, r, color, alpha=40):
    """Soft glow circle."""
    for i in range(4, 0, -1):
        a = alpha * i // 4
        rr = r * i
        col = (*color, a)
        img_layer = Image.new("RGBA", (W, H), (0,0,0,0))
        d = ImageDraw.Draw(img_layer)
        d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], fill=col)

def draw_rounded_rect(draw, x1, y1, x2, y2, r=16, fill=BG_CARD, outline=None, outline_w=2):
    draw.rounded_rectangle([x1,y1,x2,y2], radius=r, fill=fill,
                            outline=outline, width=outline_w)

def text_center(draw, text, y, fnt, color=WHITE, shadow=True):
    bbox = draw.textbbox((0,0), text, font=fnt)
    tw = bbox[2]-bbox[0]
    x = (W - tw) // 2
    if shadow:
        draw.text((x+2, y+2), text, font=fnt, fill=(0,0,0,120))
    draw.text((x, y), text, font=fnt, fill=color)
    return bbox[3]-bbox[1]   # height

def text_left(draw, text, x, y, fnt, color=WHITE, shadow=True):
    if shadow:
        draw.text((x+1, y+1), text, font=fnt, fill=(0,0,0,100))
    draw.text((x, y), text, font=fnt, fill=color)

def badge(draw, x, y, label, bg=INDIGO, fg=WHITE, fnt=None):
    fnt = fnt or font(22, bold=True)
    b = draw.textbbox((0,0), label, font=fnt)
    tw, th = b[2]-b[0], b[3]-b[1]
    pad = 10
    draw_rounded_rect(draw, x, y, x+tw+pad*2, y+th+pad, r=8, fill=bg)
    draw.text((x+pad, y+pad//2), label, font=fnt, fill=fg)
    return tw+pad*2

def pill(draw, x, y, label, color=INDIGO):
    fnt = font(20, bold=True)
    b = draw.textbbox((0,0), label, font=fnt)
    tw = b[2]-b[0]; th = b[3]-b[1]
    pad_x, pad_y = 14, 6
    bg = (*color, 40)
    draw.rounded_rectangle([x, y, x+tw+pad_x*2, y+th+pad_y*2], radius=20,
                            fill=(*color, 30), outline=color, width=2)
    draw.text((x+pad_x, y+pad_y), label, font=fnt, fill=color)
    return tw+pad_x*2+8

def divider_line(draw, y, color=INDIGO, width=3, margin=80):
    draw.line([(margin, y), (W-margin, y)], fill=color, width=width)

def star_field(img, n=80):
    """Scatter small white dots as background stars."""
    import random; random.seed(42)
    d = ImageDraw.Draw(img)
    for _ in range(n):
        x = random.randint(0, W)
        y = random.randint(0, H)
        s = random.choice([1,1,1,2])
        alpha = random.randint(60, 180)
        d.ellipse([x,y,x+s,y+s], fill=(*WHITE, alpha))

def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path)
    print(f"  ✓ {name}")
    return path

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ═══════════════════════════════════════════════════════════════════════════════
def slide_title():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, BG_DARK, (12, 8, 42))
    star_field(img)

    # Glow orbs
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([-200, -200, 800, 700], fill=(*INDIGO, 18))
    ld.ellipse([1200, 300, 2300, 1300], fill=(*PURPLE, 14))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    # Logo / Icon area
    cx = W//2
    draw_rounded_rect(d, cx-60, 130, cx+60, 250, r=24,
                      fill=(*INDIGO, 200), outline=(*VIOLET, 180), outline_w=3)
    d.text((cx-28, 158), "✦", font=font(64, bold=True), fill=WHITE)

    # Title
    text_center(d, "Stellar Basic DAO", 280, font(90, bold=True), WHITE)

    # Gradient subtitle line (simulate with two colours side by side)
    sub = "Learn Rust · Earn XLM · Govern On-Chain"
    text_center(d, sub, 395, font(36), GREY)

    divider_line(d, 468, INDIGO, 2, 280)

    # Tag pills
    tags = ["Soroban Smart Contracts", "NestJS Backend", "Next.js 15 Frontend",
            "Learn-to-Earn", "AI Mentor", "DAO Governance"]
    total_w = sum(draw.textbbox((0,0), t, font=font(22, bold=True))[2] + 56 for draw, t in
                  [(d, t) for t in tags])
    x = (W - min(total_w, W-100)) // 2
    y = 498
    colors = [INDIGO, PURPLE, VIOLET, CYAN, EMERALD, AMBER]
    for i, tag in enumerate(tags):
        w2 = pill(d, x, y, tag, colors[i % len(colors)])
        x += w2
        if x > W - 200:
            x = 140; y += 52

    # Stellar badge
    draw_rounded_rect(d, W//2-140, 640, W//2+140, 700, r=12,
                      fill=(255,255,255,15), outline=(*INDIGO, 120), outline_w=2)
    text_center(d, "⛓  Built on Stellar Testnet · Protocol 28", 654, font(26), GREY)

    # URL
    text_center(d, "frontend-blue-nu-kqspbfet91.vercel.app", 740, font(28, bold=True), INDIGO)

    # Bottom tagline
    text_center(d, "The first decentralised Rust programming academy on Stellar", 820, font(32), (*WHITE, 180))

    return save(img.convert("RGB"), "01_title.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — THE PROBLEM
# ═══════════════════════════════════════════════════════════════════════════════
def slide_problem():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,5,25), (20,8,8))
    star_field(img)

    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([W-600, -200, W+400, 800], fill=(239,68,68, 12))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    badge(d, 80, 60, "  THE PROBLEM  ", bg=(239,68,68), fnt=font(26,True))
    text_left(d, "Developers want to learn Web3 — but there's no trusted, rewarding path.", 80, 140, font(46, bold=True), WHITE)

    problems = [
        ("📚", "Scattered Learning",      "No structured Rust → Soroban curriculum in one place."),
        ("💸", "No Real Incentives",       "Learners get certificates; nobody pays for real progress."),
        ("🤖", "No AI Guidance",           "Stuck on ownership, lifetimes, async? You're on your own."),
        ("🔒", "Centralised Credentials", "Certificates live in a corporate database — not on-chain."),
        ("🗳️", "No Community Voice",       "Course quality is dictated top-down. No learner governance."),
    ]
    y = 270
    for icon, title, desc in problems:
        draw_rounded_rect(d, 80, y, W-80, y+88, r=14,
                          fill=(239,68,68, 18), outline=(239,68,68, 60), outline_w=1)
        d.text((108, y+22), icon, font=font(34), fill=WHITE)
        text_left(d, title, 170, y+14, font(30, bold=True), (252,165,165))
        text_left(d, desc,  170, y+50, font(26), GREY)
        y += 106

    text_center(d, "Millions of aspiring blockchain developers. Zero incentive-aligned learning platforms.", 970, font(30), (*AMBER, 200))
    return save(img.convert("RGB"), "02_problem.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — THE SOLUTION
# ═══════════════════════════════════════════════════════════════════════════════
def slide_solution():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (10,28,20))
    star_field(img)

    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([-300, 200, 800, 1100], fill=(*EMERALD, 12))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    badge(d, 80, 60, "  THE SOLUTION  ", bg=EMERALD, fg=(8,24,16), fnt=font(26,True))

    text_left(d, "Stellar Basic DAO:", 80, 138, font(58, bold=True), WHITE)
    text_left(d, "A fully decentralised, learn-to-earn Rust academy on Stellar.", 80, 215, font(36), GREY)

    solutions = [
        (INDIGO,   "🎓", "Structured Rust Paths",   "Beginner → Soroban/Web3 expert. Browser-based sandbox."),
        (EMERALD,  "💰", "On-Chain XLM Rewards",     "Complete a task → Soroban escrow releases XLM instantly."),
        (PURPLE,   "🤖", "AI Mentor (Claude)",        "Code review, hints, automated grading — 24/7."),
        (CYAN,     "🔗", "On-Chain Credentials",      "Certificates minted as Soroban tokens. Yours forever."),
        (AMBER,    "🗳️", "DAO Governance",             "M-of-N multisig. Learners vote on curriculum & rewards."),
        (VIOLET,   "📱", "Web + Mobile",              "Next.js 15 + React Native / Expo. Freighter wallet."),
    ]
    cols = 2; col_w = (W - 160) // cols
    y = 330
    for i, (color, icon, title, desc) in enumerate(solutions):
        col = i % cols
        x = 80 + col * col_w
        row = i // cols
        ry = y + row * 115
        draw_rounded_rect(d, x, ry, x+col_w-20, ry+105, r=14,
                          fill=(*color, 20), outline=(*color, 80), outline_w=2)
        d.text((x+14, ry+18), icon, font=font(34), fill=WHITE)
        text_left(d, title, x+64, ry+14, font(28, bold=True), color)
        text_left(d, desc,  x+64, ry+52, font(22), GREY)

    text_center(d, "One platform. Real rewards. Trustless by design.", 970, font(34, bold=True),
                (*EMERALD, 220))
    return save(img.convert("RGB"), "03_solution.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — LIVE FRONTEND (simulated screenshot)
# ═══════════════════════════════════════════════════════════════════════════════
def slide_live_demo():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (16,12,40))
    star_field(img)

    badge(d, 80, 50, "  LIVE DEPLOYMENT  ", bg=EMERALD, fg=(8,24,16), fnt=font(26,True))
    text_left(d, "Running on Vercel · Testnet Protocol 28", 80, 118, font(34), GREY)

    # Browser chrome mock
    browser_x, browser_y = 80, 170
    browser_w, browser_h = W - 160, 780
    draw_rounded_rect(d, browser_x, browser_y, browser_x+browser_w, browser_y+browser_h,
                      r=12, fill=(22,22,44), outline=(*INDIGO, 120), outline_w=2)

    # Browser toolbar
    draw_rounded_rect(d, browser_x, browser_y, browser_x+browser_w, browser_y+48,
                      r=12, fill=(30,30,55))
    # Traffic lights
    for i, col in enumerate([(239,68,68),(251,191,36),(52,211,153)]):
        cx = browser_x + 20 + i*22
        d.ellipse([cx, browser_y+16, cx+14, browser_y+30], fill=col)
    # URL bar
    draw_rounded_rect(d, browser_x+80, browser_y+10, browser_x+browser_w-20, browser_y+38,
                      r=6, fill=(40,40,70))
    d.text((browser_x+100, browser_y+15), "🔒  frontend-blue-nu-kqspbfet91.vercel.app",
           font=font(20), fill=GREY)

    # App content simulation
    content_x = browser_x + 10
    content_y = browser_y + 55
    content_w = browser_w - 20
    content_h = browser_h - 60

    # Sidebar
    sidebar_w = 240
    draw_rounded_rect(d, content_x, content_y, content_x+sidebar_w, content_y+content_h,
                      r=0, fill=(14,14,32))
    nav_items = [("Dashboard","✅"), ("Link Generator",""), ("Marketplace",""),
                 ("Notifications",""), ("Settings","")]
    ny = content_y + 20
    for label, active in nav_items:
        bg = (*INDIGO, 40) if active else (255,255,255,0)
        draw_rounded_rect(d, content_x+10, ny, content_x+sidebar_w-10, ny+38,
                          r=8, fill=bg)
        col = WHITE if active else GREY
        text_left(d, label, content_x+20, ny+10, font(22, bold=bool(active)), col)
        ny += 48

    # Main content area
    main_x = content_x + sidebar_w + 10
    main_y = content_y + 10
    main_w = content_w - sidebar_w - 20

    # Stats cards row
    stats = [("Total Revenue", "$1,240.50", "+12.5%", INDIGO),
             ("Success Rate",  "98.2%",     "↑ 0.3%",  EMERALD),
             ("Available Payout","850 USDC","Ready",   PURPLE)]
    card_w = (main_w - 30) // 3
    cx2 = main_x
    for title, val, sub, color in stats:
        draw_rounded_rect(d, cx2, main_y, cx2+card_w-10, main_y+120, r=12,
                          fill=(*color, 25), outline=(*color, 80), outline_w=2)
        text_left(d, title, cx2+14, main_y+12, font(20), GREY)
        text_left(d, val,   cx2+14, main_y+44, font(34, bold=True), WHITE)
        draw_rounded_rect(d, cx2+14, main_y+88, cx2+14+80, main_y+112,
                          r=10, fill=(*color, 40))
        text_left(d, sub, cx2+20, main_y+92, font(18, bold=True), color)
        cx2 += card_w

    # Activity table header
    ty = main_y + 140
    draw_rounded_rect(d, main_x, ty, main_x+main_w-10, ty+38, r=0,
                      fill=(30,30,55))
    for i, col in enumerate(["Transaction ID","Asset","Status","Date","Action"]):
        text_left(d, col, main_x + 16 + i*(main_w//5), ty+12, font(18, bold=True), GREY)

    rows = [("GD2P...5H2W","50 USDC","● Pending","2 mins ago","Extend TTL"),
            ("GD1R...3K9L","125 XLM","● Settled","Jan 20","Cleanup"),
            ("GC8T...9Q0M","20 USDC","● Privacy","Jan 19","Cleanup")]
    row_colors = [AMBER, EMERALD, INDIGO]
    ry2 = ty + 40
    for i, (tid, asset, status, date, action) in enumerate(rows):
        bg = (*INDIGO, 8) if i % 2 == 0 else (0,0,0,0)
        d.rectangle([main_x, ry2, main_x+main_w-10, ry2+38], fill=(*BG_CARD, 100))
        items = [tid, asset, status, date, action]
        for j, item in enumerate(items):
            col = row_colors[i] if j==2 else (INDIGO if j==4 else WHITE)
            text_left(d, item, main_x + 16 + j*(main_w//5), ry2+12, font(19), col)
        ry2 += 40

    # Vercel badge
    draw_rounded_rect(d, W-320, H-50, W-20, H-15, r=8,
                      fill=(*EMERALD, 40), outline=(*EMERALD, 120), outline_w=2)
    text_left(d, "✓ LIVE ON VERCEL", W-308, H-42, font(22, bold=True), EMERALD)

    return save(img.convert("RGB"), "04_live_demo.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — SMART CONTRACTS
# ═══════════════════════════════════════════════════════════════════════════════
def slide_contracts():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (20,8,35))
    star_field(img)

    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([W//2-400, -300, W//2+400, 500], fill=(*PURPLE, 14))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    badge(d, 80, 55, "  SOROBAN SMART CONTRACTS  ", bg=PURPLE, fnt=font(26,True))
    text_left(d, "4 modular sub-contracts · Stellar Testnet · Protocol 28 · All verified on-chain",
              80, 130, font(28), GREY)

    contracts = [
        ("stellar-dao-escrow",    "84 KB", INDIGO,  "deposit · withdraw · refund · dispute · batch · privacy",
         "CARWR7ZW...27PMF"),
        ("stellar-dao-governance","85 KB", PURPLE,  "proposals · signers · admin · upgrade gating · health_check",
         "CDR27RYZ...LLVAPF"),
        ("stellar-dao-stealth",   "55 KB", VIOLET,  "register_ephemeral_key · stealth_withdraw · status",
         "CBQQ7MXK...RKFWBD"),
        ("stellar-dao-fee",       "47 KB", CYAN,    "set_fee_config · oracle fees · rotate_fee_collector",
         "CBYSO64O...Z5LBNU"),
    ]
    y = 200
    for name, size, color, funcs, cid in contracts:
        draw_rounded_rect(d, 80, y, W-80, y+118, r=16,
                          fill=(*color, 18), outline=(*color, 100), outline_w=2)
        # Name + size badge
        text_left(d, "▣", 104, y+16, mono(36), color)
        text_left(d, name, 150, y+16, mono(32), WHITE)
        badge(d, W-230, y+22, size, bg=(*color, 80), fg=WHITE, fnt=font(22, True))
        # Contract ID
        text_left(d, f"Contract ID: {cid}", 150, y+58, mono(20), (*color, 180))
        # Functions
        text_left(d, funcs, 104, y+88, font(22), GREY)
        y += 134

    # State machine mini
    draw_rounded_rect(d, 80, 740, W-80, 840, r=12,
                      fill=(255,255,255,8), outline=(*AMBER, 60), outline_w=1)
    states = ["Pending", "→", "Spent", "  |  ", "Pending", "→", "Refunded",
              "  |  ", "Pending", "→", "Disputed", "→", "Resolved"]
    x2 = 130
    for s in states:
        col = EMERALD if s in ("Spent","Resolved") else AMBER if s in ("Refunded",) else \
              PURPLE if s in ("Disputed",) else INDIGO if s == "Pending" else GREY
        text_left(d, s, x2, 784, font(22, bold=s not in ("→","  |  ")), col)
        x2 += draw.textbbox((0,0), s, font=font(22))[2] + 8

    text_center(d, "Deployer: GDFFOJHT2ARW23Y4QUSPEKVKHCRFKDA6DOYN7CK6PROAB3JYRJXYG7AL", 880,
                font(22), (*GREY, 160))
    return save(img.convert("RGB"), "05_contracts.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════════════
def slide_architecture():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (10,20,30))
    star_field(img)

    badge(d, 80, 55, "  FULL-STACK ARCHITECTURE  ", bg=CYAN, fg=(5,20,25), fnt=font(26,True))

    layers = [
        ("CLIENT LAYER",    VIOLET, 160, [
            ("Next.js 15 Web App", "React 19 · Tailwind v4 · Freighter Wallet", W//4-40),
            ("React Native / Expo", "iOS · Android · Biometric Auth", 3*W//4-40),
        ]),
        ("BACKEND LAYER",   INDIGO, 340, [
            ("NestJS 10 API", "Auth · Payments · Links · Analytics · Webhooks", W//3-20),
            ("Soroban Tooling", "Contract clients · Event ingestion · RPC", 2*W//3-20),
            ("Infrastructure", "Supabase · Redis · Sentry · Prometheus", W-200),
        ]),
        ("BLOCKCHAIN LAYER",PURPLE, 540, [
            ("Escrow 84KB", "deposit · withdraw · dispute", W//4+20),
            ("Governance 85KB","proposals · signers · upgrade", W//2+20),
            ("Stealth 55KB","stealth addresses · ephemeral keys", 3*W//4+20),
            ("Fee Router 47KB","fees · oracle · collector", W-180),
        ]),
        ("INFRA LAYER",     EMERALD,720, [
            ("Vercel Frontend", "frontend-blue-nu-kqspbfet91.vercel.app", W//3),
            ("Render Backend","stellar-basic-dao-backend.onrender.com", 2*W//3),
            ("Cloudflare R2","Media / Asset CDN", W-200),
        ]),
    ]

    for layer_name, color, y, boxes in layers:
        # Layer label
        draw_rounded_rect(d, 80, y-4, 80+len(layer_name)*15+20, y+28, r=6,
                          fill=(*color, 60))
        text_left(d, layer_name, 88, y, font(20, bold=True), color)

        box_count = len(boxes)
        if box_count > 0:
            bx = 80
            for title, sub, cx in boxes:
                bw = min(cx - bx - 10, (W-160)//box_count - 10)
                draw_rounded_rect(d, bx, y+32, bx+bw, y+148, r=10,
                                  fill=(*color, 20), outline=(*color, 80), outline_w=2)
                text_left(d, title, bx+12, y+44, font(24, bold=True), WHITE)
                # word-wrap sub
                words = sub.split(" · ")
                wy = y+78
                for w2 in words[:2]:
                    text_left(d, "· "+w2, bx+12, wy, font(19), GREY)
                    wy += 28
                bx += bw + 10

        # Arrow down (except last layer)
        if y < 720:
            ax = W//2
            d.line([(ax, y+152), (ax, y+175)], fill=(*color, 120), width=2)
            d.polygon([(ax-8, y+170), (ax+8, y+170), (ax, y+183)], fill=(*color, 120))

    return save(img.convert("RGB"), "06_architecture.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — KEY FEATURES
# ═══════════════════════════════════════════════════════════════════════════════
def slide_features():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (8,20,16))
    star_field(img)

    badge(d, 80, 55, "  KEY FEATURES  ", bg=AMBER, fg=(24,16,4), fnt=font(26,True))
    text_left(d, "Everything a Web3 education platform needs — on one chain.", 80, 128, font(38), GREY)

    features = [
        (INDIGO,  "🎓", "Learn-to-Earn Academy",
                        ["Structured Rust → Soroban paths",
                         "Browser WASM code sandbox",
                         "AI-graded submissions (Claude)"]),
        (EMERALD, "💰", "Trustless XLM Rewards",
                        ["Soroban escrow auto-releases on completion",
                         "Anti-cheat oracle signatures",
                         "Fee router: platform + arbiter splits"]),
        (PURPLE,  "🗳️", "On-Chain DAO Governance",
                        ["M-of-N multisig proposals",
                         "Upgrade gating & admin rotation",
                         "Leaderboard-driven prize pools"]),
        (CYAN,    "📱", "Full-Stack + Mobile",
                        ["Next.js 15 + NestJS + Expo 54",
                         "Freighter wallet · Soroban events",
                         "Turborepo monorepo · 35+ modules"]),
        (VIOLET,  "🤖", "AI-Powered Mentoring",
                        ["Claude chat + code review 24/7",
                         "Personalised learning hints",
                         "Automated pre-scoring pipeline"]),
        (AMBER,   "🏆", "Gamification & NFTs",
                        ["XP, streaks, level progression",
                         "Achievement NFT badges on-chain",
                         "Weekly challenge pools"]),
    ]
    cols = 3; col_w = (W-160) // cols
    for i, (color, icon, title, points) in enumerate(features):
        col = i % cols
        row = i // cols
        x = 80 + col * col_w
        y = 220 + row * 280
        bh = 255
        draw_rounded_rect(d, x, y, x+col_w-15, y+bh, r=14,
                          fill=(*color, 18), outline=(*color, 90), outline_w=2)
        d.text((x+14, y+14), icon, font=font(40), fill=WHITE)
        text_left(d, title, x+70, y+18, font(26, bold=True), color)
        py = y+70
        for pt in points:
            d.text((x+16, py), "▸", font=font(22, bold=True), fill=color)
            text_left(d, pt, x+38, py, font(21), GREY)
            py += 36

    return save(img.convert("RGB"), "07_features.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — WHY STELLAR / DIFFERENTIATION
# ═══════════════════════════════════════════════════════════════════════════════
def slide_why_stellar():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (6,18,30))
    star_field(img)

    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([W-500, H-500, W+300, H+400], fill=(*CYAN, 14))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    badge(d, 80, 55, "  WHY STELLAR + DIFFERENTIATION  ", bg=CYAN, fg=(4,20,24), fnt=font(26,True))

    # Left: why stellar
    text_left(d, "Why Stellar?", 80, 130, font(42, bold=True), WHITE)
    reasons = [
        ("⚡", "3–5 sec settlement",    "Ideal for instant micro-reward payouts"),
        ("💲", "Near-zero fees",          "High-frequency learn-to-earn micro-payments"),
        ("🦀", "Soroban = Rust",          "Learners literally build what they're learning"),
        ("🌍", "XLM global reach",        "No bank account needed — worldwide access"),
        ("🔌", "Freighter UX",            "Low-friction Web3 onboarding for new devs"),
        ("🪙", "SAC + Path Payments",     "USDC, AQUA, yXLM cross-asset flexibility"),
    ]
    y = 200
    for icon, title, desc in reasons:
        draw_rounded_rect(d, 80, y, 900, y+72, r=10,
                          fill=(255,255,255,8), outline=(*CYAN, 50), outline_w=1)
        d.text((98, y+14), icon, font=font(30), fill=WHITE)
        text_left(d, title, 148, y+10, font(26, bold=True), CYAN)
        text_left(d, desc,  148, y+42, font(22), GREY)
        y += 82

    divider_line(d, 180, (*GREY, 40), 1, 960)

    # Right: differentiation vs competitors
    text_left(d, "Unique on Stellar", 960, 130, font(42, bold=True), WHITE)
    table_y = 200
    headers = ["Feature", "Stellar Basic DAO", "Generic Courses"]
    col_xs  = [960, 1210, 1560]
    for j, (hdr, cx) in enumerate(zip(headers, col_xs)):
        text_left(d, hdr, cx, table_y, font(24, bold=True),
                  CYAN if j==0 else EMERALD if j==1 else (239,68,68))
    table_y += 40
    rows = [
        ("XLM Rewards",        "✅ On-chain escrow",    "❌ None"),
        ("Soroban Contracts",  "✅ 4 verified live",    "❌ None"),
        ("AI Mentor",          "✅ Claude-powered",     "⚠️ Optional"),
        ("DAO Governance",     "✅ M-of-N multisig",    "❌ None"),
        ("NFT Certificates",   "✅ Soroban tokens",     "⚠️ Centralised"),
        ("Mobile App",         "✅ Expo 54",            "⚠️ Web only"),
        ("Open Source",        "✅ MIT License",        "❌ Proprietary"),
    ]
    for i, (feat, ours, theirs) in enumerate(rows):
        bg = (*INDIGO, 12) if i%2==0 else (0,0,0,0)
        d.rectangle([960, table_y, W-60, table_y+40], fill=bg)
        text_left(d, feat,   col_xs[0], table_y+8, font(22), GREY)
        text_left(d, ours,   col_xs[1], table_y+8, font(22), EMERALD)
        text_left(d, theirs, col_xs[2], table_y+8, font(22), (239,68,68) if "❌" in theirs else AMBER)
        table_y += 42

    return save(img.convert("RGB"), "08_why_stellar.png")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — TRACTION / ROADMAP
# ═══════════════════════════════════════════════════════════════════════════════
def slide_traction():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (12,8,30))
    star_field(img)

    badge(d, 80, 55, "  TRACTION & ROADMAP  ", bg=VIOLET, fnt=font(26,True))

    # Metrics row
    metrics = [
        ("4",     "Smart Contracts\nDeployed",     INDIGO),
        ("271 KB","WASM on\nTestnet",              PURPLE),
        ("35+",   "Backend\nModules",              EMERALD),
        ("18",    "Frontend\nRoutes (SSR)",        CYAN),
        ("28",    "Protocol\nVersion",             AMBER),
        ("100%",  "Verified\nOn-Chain",            VIOLET),
    ]
    mx = 80; mw = (W-160)//len(metrics)
    for val, label, color in metrics:
        draw_rounded_rect(d, mx, 145, mx+mw-10, 295, r=12,
                          fill=(*color, 25), outline=(*color, 90), outline_w=2)
        text_center_bounded(d, val,   mx, mw-10, 158, font(52, bold=True), color)
        lines = label.split("\n")
        liny = 225
        for l in lines:
            text_center_bounded(d, l, mx, mw-10, liny, font(20), GREY)
            liny += 28
        mx += mw

    divider_line(d, 310, (*GREY, 40), 1)

    # Roadmap
    phases = [
        ("✅","Phase 1\nFoundation",    EMERALD, [
            "Turborepo monorepo","4 Soroban contracts live",
            "Frontend on Vercel","Backend on Render"]),
        ("🚧","Phase 2\nAcademy Core", AMBER, [
            "Course + lesson API","Claude AI grading",
            "XLM reward pools","Freighter integration"]),
        ("🔜","Phase 3\nSocial DAO",   INDIGO, [
            "Community feed","Certificate NFTs",
            "On-chain governance","Leaderboards"]),
        ("🌐","Phase 4\nEcosystem",    PURPLE, [
            "DAO curriculum","WebRTC live sessions",
            "Cross-chain certs","SDK for 3rd-party"]),
    ]
    px = 80; pw = (W-160)//len(phases)
    for icon, title, color, items in phases:
        py = 330
        d.text((px+pw//2-20, py), icon, font=font(36), fill=WHITE)
        py += 48
        lines = title.split("\n")
        for l in lines:
            text_center_bounded(d, l, px, pw, py, font(26, bold=True), color)
            py += 34
        py += 10
        for item in items:
            draw_rounded_rect(d, px+8, py, px+pw-12, py+34, r=6,
                              fill=(*color, 20), outline=(*color, 50), outline_w=1)
            text_left(d, "▸ "+item, px+18, py+8, font(20), GREY)
            py += 42
        # Timeline bar
        bar_y = py + 20
        d.rounded_rectangle([px+8, bar_y, px+pw-12, bar_y+8], radius=4, fill=(*color, 60))
        px += pw

    return save(img.convert("RGB"), "09_traction.png")

def text_center_bounded(draw, text, x_offset, w, y, fnt, color):
    b = draw.textbbox((0,0), text, font=fnt)
    tw = b[2]-b[0]
    cx = x_offset + (w - tw) // 2
    draw.text((cx, y), text, font=fnt, fill=color)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — CALL TO ACTION
# ═══════════════════════════════════════════════════════════════════════════════
def slide_cta():
    img = Image.new("RGBA", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)
    gradient_bg(d, W, H, (8,8,24), (12,8,40))
    star_field(img)

    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([-200, -200, 900, 900], fill=(*INDIGO, 18))
    ld.ellipse([W-700, H-600, W+400, H+400], fill=(*PURPLE, 14))
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    # Central icon
    cx = W//2
    draw_rounded_rect(d, cx-70, 80, cx+70, 200, r=28,
                      fill=(*INDIGO, 220), outline=(*VIOLET, 200), outline_w=4)
    d.text((cx-34, 110), "✦", font=font(74, bold=True), fill=WHITE)

    text_center(d, "Join Stellar Basic DAO", 228, font(82, bold=True), WHITE)
    text_center(d, "Learn Rust. Earn XLM. Govern the future of Web3 education.", 340, font(36), GREY)

    divider_line(d, 408, INDIGO, 2, 200)

    # CTA boxes
    links = [
        ("🌐", "Live Demo",         "frontend-blue-nu-kqspbfet91.vercel.app", INDIGO),
        ("⛓", "Smart Contracts",   "Deployed on Stellar Testnet · 4 sub-contracts", PURPLE),
        ("🐙", "GitHub",            "github.com/Sorobantopz/Stellar-Basic-DAO", EMERALD),
        ("📖", "Docs & API",        "swagger /docs · openapi.yaml · 35+ modules", CYAN),
    ]
    box_w = (W - 200) // 2
    bx, by = 100, 440
    for i, (icon, title, url, color) in enumerate(links):
        col = i % 2; row = i // 2
        x = bx + col*(box_w+20)
        y = by + row*140
        draw_rounded_rect(d, x, y, x+box_w, y+120, r=16,
                          fill=(*color, 22), outline=(*color, 120), outline_w=3)
        d.text((x+20, y+20), icon, font=font(44), fill=WHITE)
        text_left(d, title, x+78, y+18, font(30, bold=True), color)
        text_left(d, url,   x+78, y+62, font(22), GREY)

    # Bottom final statement
    text_center(d, "Open Source · MIT License · Built with 🦀 Rust, 💙 Stellar, ❤️ for developers", 965,
                font(28), (*WHITE, 160))

    return save(img.convert("RGB"), "10_cta.png")


# ── Run all slides ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Monkeypatch draw reference for pill/badge functions
    import sys
    _img = Image.new("RGBA", (1,1))
    draw = ImageDraw.Draw(_img)

    print("Generating pitch video frames...")
    slide_title()
    slide_problem()
    slide_solution()
    slide_live_demo()
    slide_contracts()
    slide_architecture()
    slide_features()
    slide_why_stellar()
    slide_traction()
    slide_cta()
    print(f"\nAll frames saved to {OUT}")
