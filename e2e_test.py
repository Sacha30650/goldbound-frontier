import json
from pathlib import Path
from playwright.sync_api import sync_playwright

results = {"console_errors": [], "page_errors": [], "checks": {}}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/snap/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    page.on("console", lambda msg: results["console_errors"].append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: results["page_errors"].append(str(exc)))
    page.goto("http://127.0.0.1:4173", wait_until="networkidle")
    results["checks"]["title"] = page.title()
    results["checks"]["mobile_no_horizontal_overflow"] = page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    results["checks"]["scan_visible"] = page.locator("#scanBtn").is_visible()
    energy_before = page.locator("#energy").inner_text()
    page.locator("#scanBtn").click()
    page.wait_for_timeout(1100)
    page.locator("#scanBtn").click()
    page.wait_for_timeout(300)
    results["checks"]["scan_energy_before"] = energy_before
    results["checks"]["scan_energy_after"] = page.locator("#energy").inner_text()
    results["checks"]["last_find"] = page.locator("#lastFind strong").inner_text()
    page.locator('[data-target="village"]').click()
    results["checks"]["village_visible"] = page.locator("#villageView").is_visible()
    before_level = page.locator('[data-building="camp"]').locator('..').locator('.level-tag').inner_text()
    page.locator('[data-building="camp"]').click()
    results["checks"]["building_upgraded"] = page.locator('[data-building="camp"]').locator('..').locator('.level-tag').inner_text() != before_level
    page.locator('[data-target="shop"]').click()
    results["checks"]["shop_visible"] = page.locator("#shopView").is_visible()
    page.locator('[data-ad="energy"]').click()
    results["checks"]["ad_modal_visible"] = page.locator("#adModal").is_visible()
    page.wait_for_timeout(5200)
    results["checks"]["ad_claim_enabled"] = page.locator("#claimAd").is_enabled()
    page.locator("#claimAd").click()
    results["checks"]["ad_closed"] = not page.locator("#adModal").is_visible()
    page.evaluate("window.scrollTo(0, 0)")
    page.screenshot(path="/root/goldbound/mobile-preview.png", full_page=False)

    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    desktop.goto("http://127.0.0.1:4173", wait_until="networkidle")
    results["checks"]["desktop_scan_visible"] = desktop.locator("#scanBtn").is_visible()
    results["checks"]["desktop_side_cards"] = desktop.locator(".side-stack .card").count()
    results["checks"]["desktop_no_horizontal_overflow"] = desktop.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    desktop.screenshot(path="/root/goldbound/desktop-preview.png", full_page=False)
    browser.close()

Path("/root/goldbound/test-results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
print(json.dumps(results, indent=2, ensure_ascii=False))
if results["console_errors"] or results["page_errors"] or not all([
    results["checks"]["scan_visible"], results["checks"]["village_visible"],
    results["checks"]["shop_visible"], results["checks"]["ad_claim_enabled"],
    results["checks"]["ad_closed"], results["checks"]["desktop_scan_visible"],
    results["checks"]["building_upgraded"], results["checks"]["mobile_no_horizontal_overflow"],
    results["checks"]["desktop_no_horizontal_overflow"]
]):
    raise SystemExit(1)
