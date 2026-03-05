#!/usr/bin/env python3
"""
Webcam discovery script for PowderCast resorts.

Searches YouTube for live webcam streams at each resort and scrapes
existing webcam pages for embeddable sources. Outputs to webcams.json.

Usage:
    python3 data-pipeline/tools/webcam_scraper.py [--limit N] [--slug SLUG]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import time
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(SCRIPT_DIR, "..", "..")
RESORTS_PATH = os.path.join(APP_DIR, "public", "data", "resorts.json")
OUTPUT_PATH = os.path.join(APP_DIR, "public", "data", "webcams.json")

# Find yt-dlp binary — may be in user's Python bin
YTDLP_BIN = "yt-dlp"
_user_bin = os.path.expanduser("~/Library/Python/3.9/bin/yt-dlp")
if os.path.isfile(_user_bin):
    YTDLP_BIN = _user_bin


def search_youtube(query: str, max_results: int = 5) -> list[dict]:
    """Search YouTube for videos matching query using yt-dlp."""
    try:
        result = subprocess.run(
            [
                YTDLP_BIN,
                f"ytsearch{max_results}:{query}",
                "--flat-playlist",
                "--dump-json",
                "--no-warnings",
                "--quiet",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        entries = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return entries
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.warning("yt-dlp search failed: %s", e)
        return []


def verify_is_live(vid_id: str) -> bool:
    """Check if a YouTube video is currently a live stream using yt-dlp metadata."""
    try:
        result = subprocess.run(
            [
                YTDLP_BIN,
                f"https://www.youtube.com/watch?v={vid_id}",
                "--dump-json",
                "--no-warnings",
                "--quiet",
                "--skip-download",
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            return False
        meta = json.loads(result.stdout)
        return meta.get("live_status") == "is_live" or meta.get("is_live") is True
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
        return False


def is_live_webcam(entry: dict, resort_name: str) -> bool:
    """Check if a YouTube entry looks like a live webcam stream for this resort."""
    title = (entry.get("title") or "").lower()
    channel = (entry.get("channel") or entry.get("uploader") or "").lower()
    description = (entry.get("description") or "").lower()
    text = f"{title} {channel} {description}"

    # Must reference the resort somewhere
    resort_lower = resort_name.lower()
    # Check for any significant word from the resort name (>3 chars)
    resort_words = [w for w in resort_lower.split() if len(w) > 3]
    has_resort_ref = any(w in text for w in resort_words) if resort_words else resort_lower in text
    if not has_resort_ref:
        return False

    # Must contain webcam-related keywords
    webcam_words = ["webcam", "live cam", "livecam", "mountain cam", "ski cam",
                    "base cam", "summit cam", "live stream", "livestream"]
    has_webcam_word = any(w in title for w in webcam_words)
    # Or is a live stream
    is_live = entry.get("live_status") == "is_live" or entry.get("is_live")
    # Filter out vlogs, reviews, compilations
    reject_words = ["vlog", "review", "compilation", "top 10", "worst", "best", "trip", "vacation"]
    has_reject_word = any(w in title for w in reject_words)
    return (has_webcam_word or is_live) and not has_reject_word


def extract_cam_name(title: str, resort_name: str) -> str:
    """Extract a short cam name from the video title."""
    # Remove resort name
    name = title
    for word in resort_name.lower().split():
        name = re.sub(re.escape(word), "", name, flags=re.IGNORECASE)
    # Remove common filler words
    for filler in ["webcam", "live cam", "livecam", "live", "ski resort", "resort",
                    "mountain", "cam", "hd", "4k", "|", "-", "–", ":"]:
        name = re.sub(re.escape(filler), "", name, flags=re.IGNORECASE)
    name = name.strip(" -–|:")
    if not name or len(name) < 2:
        return "Live Cam"
    return name.strip().title()[:30]


def find_youtube_webcams(resort_name: str) -> list[dict]:
    """Search YouTube for webcam streams at a resort."""
    queries = [
        f'"{resort_name}" ski webcam live',
        f'"{resort_name}" mountain webcam',
    ]

    seen_ids = set()
    cams = []

    for query in queries:
        entries = search_youtube(query, max_results=3)
        for entry in entries:
            vid_id = entry.get("id")
            if not vid_id or vid_id in seen_ids:
                continue
            if not is_live_webcam(entry, resort_name):
                continue
            seen_ids.add(vid_id)
            # Verify the video is actually a live stream right now
            if not verify_is_live(vid_id):
                logger.debug("  Skipping %s (not live)", vid_id)
                continue
            cam_name = extract_cam_name(entry.get("title", ""), resort_name)
            cams.append({
                "name": cam_name,
                "url": f"https://www.youtube.com/live/{vid_id}",
                "type": "youtube",
            })

    return cams


def scrape_resort_webcam_page(url: str) -> list[dict]:
    """Try to find embeddable video sources from a resort's webcam page."""
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        cams = []
        # Look for YouTube embeds in iframes
        yt_pattern = r'(?:youtube\.com/embed/|youtube\.com/live/|youtu\.be/)([a-zA-Z0-9_-]{11})'
        seen_yt = set()
        for match in re.finditer(yt_pattern, html):
            vid_id = match.group(1)
            if vid_id in seen_yt:
                continue
            seen_yt.add(vid_id)
            # Only include if the video is actually live
            if not verify_is_live(vid_id):
                continue
            cams.append({
                "name": "Resort Cam",
                "url": f"https://www.youtube.com/live/{vid_id}",
                "type": "youtube",
            })

        # Look for other iframe video embeds (hdontap, webcams.travel, etc.)
        iframe_pattern = r'<iframe[^>]+src=["\']([^"\']+)["\']'
        for match in re.finditer(iframe_pattern, html, re.IGNORECASE):
            src = match.group(1)
            parsed = urlparse(src)
            if parsed.hostname and any(h in parsed.hostname for h in
                                        ["hdontap", "webcams.travel", "webviewcams",
                                         "camstreamer", "roundshot", "panomax"]):
                cams.append({
                    "name": "Resort Cam",
                    "url": src if src.startswith("http") else f"https:{src}",
                    "type": "iframe",
                })

        return cams
    except Exception as e:
        logger.debug("Failed to scrape %s: %s", url, e)
        return []


def discover_webcams(resort: dict) -> list[dict]:
    """Find all webcam sources for a resort."""
    name = resort["name"]
    webcam_url = resort.get("webcam_url")

    # Search YouTube
    cams = find_youtube_webcams(name)

    # Scrape existing webcam page if available
    if webcam_url:
        page_cams = scrape_resort_webcam_page(webcam_url)
        # Dedupe by URL
        existing_urls = {c["url"] for c in cams}
        for cam in page_cams:
            if cam["url"] not in existing_urls:
                cams.append(cam)
                existing_urls.add(cam["url"])

        # Always include the webcam page as a fallback link
        if not any(c["url"] == webcam_url for c in cams):
            cams.append({
                "name": "All Cams",
                "url": webcam_url,
                "type": "link",
            })

    return cams


def main():
    parser = argparse.ArgumentParser(description="Discover webcam URLs for PowderCast resorts")
    parser.add_argument("--limit", type=int, default=0, help="Limit to N resorts (0 = all)")
    parser.add_argument("--slug", type=str, help="Only process a specific resort slug")
    parser.add_argument("--dry-run", action="store_true", help="Print results without saving")
    args = parser.parse_args()

    with open(RESORTS_PATH) as f:
        resorts = json.load(f)

    # Load existing webcams.json if it exists
    existing = {}
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH) as f:
            existing = json.load(f)

    if args.slug:
        resorts = [r for r in resorts if r["slug"] == args.slug]
        if not resorts:
            logger.error("Resort slug '%s' not found", args.slug)
            sys.exit(1)
    elif args.limit > 0:
        resorts = resorts[:args.limit]

    logger.info("Processing %d resorts...", len(resorts))
    webcams = dict(existing)  # Start with existing data

    for i, resort in enumerate(resorts):
        slug = resort["slug"]
        name = resort["name"]
        logger.info("[%d/%d] %s", i + 1, len(resorts), name)

        cams = discover_webcams(resort)
        if cams:
            webcams[slug] = cams
            logger.info("  Found %d cam(s): %s", len(cams),
                        ", ".join(c["name"] for c in cams))
        else:
            logger.info("  No cams found")

        # Rate limit YouTube searches
        time.sleep(1)

    if args.dry_run:
        print(json.dumps(webcams, indent=2))
    else:
        with open(OUTPUT_PATH, "w") as f:
            json.dump(webcams, f, indent=2)
        total_resorts = len(webcams)
        total_cams = sum(len(v) for v in webcams.values())
        logger.info("Saved %d cams across %d resorts to %s", total_cams, total_resorts, OUTPUT_PATH)


if __name__ == "__main__":
    main()
