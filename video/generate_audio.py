#!/usr/bin/env python3
"""
Gemini TTS Voice-over Generator for Stellar Basic DAO Pitch Video.
Uses Gemini 2.5 Flash Preview TTS to generate natural voice-overs.
"""
import os, json, base64, struct, wave, requests, time

API_KEY = os.environ.get("GEMINI_API_KEY", "")  # Set GEMINI_API_KEY env var
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent"
OUT_DIR = "/workspaces/Stellar-Basic-DAO/video/audio"
os.makedirs(OUT_DIR, exist_ok=True)

# Voice-over scripts — each slide gets natural, engaging narration
SCRIPTS = {
    "01_title": """
        Introducing Stellar Basic DAO — the world's first decentralised, learn-to-earn 
        Rust programming academy, built entirely on the Stellar blockchain.
        Learners earn real XLM by completing tasks. Tutors earn for teaching.
        And every reward, credential, and governance decision is enforced trustlessly 
        by Soroban smart contracts. This is education — reimagined for Web3.
    """,
    "02_problem": """
        Here's the problem. Developers worldwide want to enter Web3 — but there's 
        no clear, incentive-aligned path to get there.
        Learning resources are scattered. Nobody pays learners for real progress.
        When you're stuck on Rust's ownership model at two in the morning, 
        you're completely on your own.
        Credentials live in corporate databases — not on your wallet.
        And course quality? Dictated top-down, with zero community voice.
        Millions of aspiring blockchain developers. Zero platforms that truly reward them.
    """,
    "03_solution": """
        Stellar Basic DAO changes everything.
        We've built a fully decentralised programming academy where learning 
        is directly rewarded with on-chain XLM — via Soroban escrow contracts 
        that release automatically upon verified task completion.
        You get structured Rust learning paths, from beginner to Soroban expert.
        An AI mentor powered by Claude, available twenty-four seven for code reviews 
        and personalised hints.
        On-chain completion certificates — minted as Soroban tokens — 
        that you own forever, on your wallet.
        And DAO governance, where the community votes on curriculum, rewards, 
        and the protocol's future.
        One platform. Real rewards. Trustless by design.
    """,
    "04_live_demo": """
        This is the Stellar Basic DAO frontend — live right now on Vercel.
        The dashboard shows real-time payment activity with Soroban escrow entries,
        their privacy status, and one-click TTL extension and cleanup actions 
        that interact directly with deployed smart contracts.
        The analytics panel tracks transaction volume and asset distribution.
        The marketplace lets learners bid on premium usernames using on-chain auctions.
        And every interaction runs over HTTPS with Freighter wallet connectivity,
        Soroban event subscriptions, and proper CORS headers for production.
        Everything you see is deployed, live, and connected to Stellar Testnet.
    """,
    "05_contracts": """
        The on-chain logic is deployed as four independent Soroban sub-contracts 
        on Stellar Testnet, Protocol 28 — all verified with live on-chain calls.
        The Escrow contract at eighty-four kilobytes handles deposits, withdrawals, 
        refunds, multi-sig dispute resolution, partial payments, and privacy-aware views.
        The Governance contract at eighty-five kilobytes powers M-of-N multisig proposals,
        admin rotation, upgrade gating, and full deployment metadata.
        The Stealth contract registers ephemeral keys for privacy-preserving 
        stealth address deposits.
        And the Fee Router manages per-asset basis-point fees with oracle integration 
        and collector rotation.
        Each contract emits stable, versioned on-chain events — 
        indexed and consumed by the NestJS backend in real time.
    """,
    "06_architecture": """
        The architecture is full-stack and modular.
        At the top, a Next.js fifteen web app and a React Native Expo mobile app 
        communicate via REST and WebSockets with the NestJS ten backend.
        The backend hosts thirty-five-plus modules: authentication, payment links,
        contract registry, event ingestion, job queue, reconciliation, analytics, 
        notifications, webhooks, and Soroban tooling.
        Below that, the Stellar blockchain layer — four independent sub-contracts 
        sharing a common Rust library — handles all trustless logic.
        Everything is backed by Supabase PostgreSQL, Redis caching, 
        Sentry error monitoring, and Prometheus metrics.
        Deployed to Vercel for the frontend and Render for the backend API.
    """,
    "07_features": """
        Here's what makes Stellar Basic DAO a complete platform.
        A structured learn-to-earn academy with browser-based WASM sandbox and 
        AI-graded submissions, so you learn by building real Soroban contracts.
        Trustless XLM rewards through Soroban escrow — with anti-cheat oracle signatures 
        that prevent reward farming.
        On-chain DAO governance with M-of-N multisig proposals, leaderboard prize pools,
        and community-driven curriculum decisions.
        A full-stack platform covering web, mobile, and API — 
        built with Next.js fifteen, NestJS, and Expo fifty-four in a Turborepo monorepo.
        An AI-powered mentor using Claude for code review, hints, and automated grading — 
        twenty-four seven.
        And a full gamification layer: XP, streaks, level progression, 
        and on-chain NFT achievement badges.
    """,
    "08_why_stellar": """
        Why did we choose Stellar? Because it's the only blockchain where 
        all the pieces fit together perfectly for learn-to-earn.
        Three-to-five second settlement is ideal for instant micro-reward payouts 
        after every completed task.
        Near-zero fees make high-frequency micro-payments economically viable.
        Soroban uses Rust — so learners literally build on the platform they're learning.
        XLM's global reach means any learner anywhere receives rewards 
        without needing a bank account.
        Freighter provides frictionless Web3 onboarding for developers new to crypto.
        And no other project on Stellar combines Rust education, XLM incentive mechanics, 
        AI tutoring, social community, and trustless governance in a single platform.
        We're not just building on Stellar. We're building for Stellar's developer ecosystem.
    """,
    "09_traction": """
        Here's where we stand today.
        Four Soroban smart contracts deployed and verified on Stellar Testnet — 
        two hundred seventy-one kilobytes of production WASM, 
        running on Protocol twenty-eight.
        Thirty-five-plus backend modules covering every layer of the platform.
        Eighteen server-rendered frontend routes with full security headers.
        The frontend is live on Vercel. The backend is on Render.
        Phase one is complete — foundation, contracts, deployment.
        Phase two brings the academy core: courses, AI grading, and XLM reward pools.
        Phase three delivers social features, certificate NFTs, and full DAO governance.
        And Phase four opens the ecosystem with a DAO-governed curriculum, 
        WebRTC live sessions, and a developer SDK.
        The foundation is solid. The roadmap is clear. The market is ready.
    """,
    "10_cta": """
        Stellar Basic DAO is open, live, and ready to grow.
        You can explore the live frontend right now at the Vercel URL shown.
        All four smart contracts are verified on Stellar Testnet, 
        and the full source code is open under the MIT License on GitHub.
        If you're a judge, an investor, a developer, or a learner — 
        this is your invitation to join the first decentralised Rust programming academy 
        on the Stellar blockchain.
        Learn Rust. Earn XLM. Govern the future of Web3 education.
        This is Stellar Basic DAO.
    """,
}

def pcm_to_wav(pcm_data: bytes, sample_rate: int = 24000,
               num_channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Wrap raw PCM bytes in a WAV container."""
    data_len = len(pcm_data)
    wav_buf = bytearray()
    # RIFF header
    wav_buf += b'RIFF'
    wav_buf += struct.pack('<I', 36 + data_len)
    wav_buf += b'WAVE'
    # fmt chunk
    wav_buf += b'fmt '
    wav_buf += struct.pack('<I', 16)
    wav_buf += struct.pack('<H', 1)               # PCM
    wav_buf += struct.pack('<H', num_channels)
    wav_buf += struct.pack('<I', sample_rate)
    wav_buf += struct.pack('<I', sample_rate * num_channels * bits_per_sample // 8)
    wav_buf += struct.pack('<H', num_channels * bits_per_sample // 8)
    wav_buf += struct.pack('<H', bits_per_sample)
    # data chunk
    wav_buf += b'data'
    wav_buf += struct.pack('<I', data_len)
    wav_buf += pcm_data
    return bytes(wav_buf)


def generate_audio(slide_id: str, text: str, voice: str = "Charon") -> str:
    """Call Gemini TTS and save WAV file. Returns output path."""
    out_path = os.path.join(OUT_DIR, f"{slide_id}.wav")
    if os.path.exists(out_path):
        print(f"  ↩ Cached: {slide_id}.wav")
        return out_path

    text = " ".join(text.split())   # normalise whitespace
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": voice}
                }
            }
        }
    }

    print(f"  ⟳ Generating TTS: {slide_id} ({len(text)} chars)...", end="", flush=True)
    resp = requests.post(
        f"{API_URL}?key={API_KEY}",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=90
    )

    if resp.status_code != 200:
        print(f" ✗ HTTP {resp.status_code}: {resp.text[:300]}")
        return None

    data = resp.json()
    try:
        candidates = data["candidates"]
        parts = candidates[0]["content"]["parts"]
        audio_b64 = parts[0]["inlineData"]["data"]
        pcm_bytes = base64.b64decode(audio_b64)
        wav_bytes = pcm_to_wav(pcm_bytes)
        with open(out_path, "wb") as f:
            f.write(wav_bytes)
        print(f" ✓ {len(wav_bytes)//1024} KB")
        return out_path
    except (KeyError, IndexError) as e:
        print(f" ✗ Parse error: {e}")
        print("  Response keys:", list(data.keys()))
        if "candidates" in data and data["candidates"]:
            c = data["candidates"][0]
            print("  Candidate keys:", list(c.keys()))
        return None


def generate_silence(duration_s: float, path: str) -> str:
    """Generate a silent WAV file as fallback."""
    sr = 24000
    samples = int(sr * duration_s)
    pcm = b'\x00\x00' * samples
    wav = pcm_to_wav(pcm)
    with open(path, "wb") as f:
        f.write(wav)
    return path


if __name__ == "__main__":
    print("Generating voice-over audio via Gemini TTS...")
    print(f"Voice: Charon (deep, authoritative)\n")

    failed = []
    for slide_id, script in SCRIPTS.items():
        path = generate_audio(slide_id, script)
        if not path:
            print(f"  → Generating silence fallback for {slide_id}")
            fallback = os.path.join(OUT_DIR, f"{slide_id}.wav")
            generate_silence(12.0, fallback)
            failed.append(slide_id)
        time.sleep(0.5)   # Rate limit buffer

    print(f"\n✓ Done. {len(SCRIPTS)-len(failed)}/{len(SCRIPTS)} TTS generated.")
    if failed:
        print(f"  Silence fallback used for: {failed}")
    print(f"Audio files in: {OUT_DIR}")
