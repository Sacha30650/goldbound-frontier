import concurrent.futures
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, "/usr/local/lib/hermes-agent")
from tools.image_generation_tool import image_generate_tool

OUT = Path("/root/goldbound/assets")
BASE = (
    "high-end stylized 3D mobile game illustration, cinematic frontier realism, "
    "warm amber sunlight, deep teal shadows, tactile PBR materials, premium casual game art, "
    "coherent world, no words, no typography, no logos, no interface, "
)
ITEMS = {
    "frontier-hero.png": BASE + "ultrawide view of a modern gold prospecting frontier valley, charismatic lone prospector sweeping a metal detector through red desert grass in foreground, winding turquoise river, rustic timber mining village blended with modern black steel workshop, solar roofs, radio tower, distant mesas, dramatic golden hour, strong depth, central ground area clear for gameplay overlay",
    "village.png": BASE + "isometric bustling gold rush settlement upgraded into a modern eco mining town, timber saloon beside black steel modular workshop, solar panels, water tower, warm windows, tiny workers, dirt roads, crane, rugged red canyon around it, inviting prosperous atmosphere, clean readable building silhouettes",
    "river.png": BASE + "quiet hidden bend of a turquoise frontier river at dawn, metal detector and worn leather satchel resting by exposed gold-bearing gravel, old wooden sluice upgraded with modern sensors and solar battery, cottonwood trees, mist, distant rust mesas, treasure hunting adventure mood",
    "vault.png": BASE + "mysterious abandoned underground gold mine transformed into a cutting-edge treasure vault, timber supports mixed with cyan scanning lasers and rugged industrial technology, glittering quartz seams, a single extremely rare blue diamond glowing deep in rock, cinematic tunnel perspective",
}

def generate(item):
    name, prompt = item
    raw = image_generate_tool(prompt, "landscape", seed=73061 + list(ITEMS).index(name))
    data = json.loads(raw)
    if not data.get("success"):
        return name, False, data
    req = urllib.request.Request(data["image"], headers={"User-Agent": "Mozilla/5.0"})
    blob = urllib.request.urlopen(req, timeout=120).read()
    path = OUT / name
    path.write_bytes(blob)
    return name, True, {"url": data["image"], "bytes": len(blob), "path": str(path)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(generate, ITEMS.items()):
        print(json.dumps(result))
