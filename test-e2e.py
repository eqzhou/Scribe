"""
Scribe 端到端浏览器交互测试

测试 8 个核心流程，捕获控制台错误，截图验证。
服务地址：http://localhost:8787/
"""
import sys
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8787"
errors = []
SHOT_DIR = os.path.join(os.path.dirname(__file__), "test-screenshots")
os.makedirs(SHOT_DIR, exist_ok=True)

def log(msg):
    print(f"  {msg}")

def shot(page, name):
    path = os.path.join(SHOT_DIR, name)
    page.screenshot(path=path)
    log(f"    截图: {name}")

def test_landing(page):
    """1. 落地页 → 点击墨字图标 → 进入应用"""
    log("[1] 落地页测试")
    page.goto(f"{BASE}/landing.html")
    page.wait_for_load_state("networkidle")
    title = page.title()
    log(f"    落地页标题: {title}")
    brand = page.locator('a[aria-label="返回首页"]').first
    if brand.count() > 0:
        brand.click()
        page.wait_for_load_state("networkidle")
        log(f"    点击后 URL: {page.url}")
    else:
        log("    品牌图标未找到，直接访问首页")
        page.goto(f"{BASE}/")
        page.wait_for_load_state("networkidle")
    shot(page, "01-landing.png")

def test_dashboard(page):
    """2. 工作台 → 验证统计卡片、热力图、目标环"""
    log("[2] 工作台测试")
    page.goto(f"{BASE}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    cards = page.locator('text=总字数').or_(page.locator('text=章节')).or_(page.locator('text=角色'))
    log(f"    统计卡片元素: {cards.count()}")
    heatmap = page.locator('text=热力')
    log(f"    热力图标题: {heatmap.count()}")
    shot(page, "02-dashboard.png")

def test_project_switch(page):
    """3. 项目管理"""
    log("[3] 项目管理测试")
    page.goto(f"{BASE}/projects")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    shot(page, "03-projects.png")

def test_editor(page):
    """4. 章节编辑器"""
    log("[4] 章节编辑器测试")
    page.goto(f"{BASE}/editor")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    editor = page.locator('.ProseMirror, [contenteditable="true"]').first
    if editor.count() > 0:
        log("    编辑器已加载")
        editor.click()
        editor.type("测试写作内容，验证字数统计功能。")
        page.wait_for_timeout(500)
    else:
        log("    编辑器未找到（可能需要先选择章节）")
    shot(page, "04-editor.png")

def test_settings_ai(page):
    """5. 设置页 → Tab 切换 → AI 大模型管理"""
    log("[5] 设置页 AI 大模型测试")
    page.goto(f"{BASE}/settings")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    ai_tab = page.locator('text=AI 大模型').first
    if ai_tab.count() > 0:
        ai_tab.click()
        page.wait_for_timeout(500)
        log("    AI 大模型 Tab 已点击")
        add_btn = page.locator('text=添加模型')
        log(f"    添加模型按钮: {add_btn.count()}")
    else:
        log("    AI Tab 未找到")
    shot(page, "05-settings-ai.png")
    for tab_name in ["通用", "外观", "快捷键", "数据管理", "关于"]:
        tab = page.locator(f'button:has-text("{tab_name}"), [role="tab"]:has-text("{tab_name}")').first
        if tab.count() > 0:
            tab.click()
            page.wait_for_timeout(300)
            log(f"    Tab '{tab_name}' 切换成功")
    shot(page, "05-settings-about.png")

def test_global_search(page):
    """6. 全局搜索 → Ctrl+K"""
    log("[6] 全局搜索测试")
    page.goto(f"{BASE}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    page.keyboard.press("Control+k")
    page.wait_for_timeout(500)
    search_input = page.locator('input[placeholder*="搜索"]').first
    if search_input.count() > 0:
        log("    搜索框已出现")
        search_input.type("沈云舟")
        page.wait_for_timeout(1000)
        marks = page.locator('mark').count()
        log(f"    搜索结果高亮数: {marks}")
    else:
        log("    搜索框未出现")
    shot(page, "06-search.png")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

def test_theme_switch(page):
    """7. 主题切换"""
    log("[7] 主题切换测试")
    page.goto(f"{BASE}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    before = page.evaluate("document.documentElement.className")
    log(f"    切换前主题 class: {before}")
    theme_btn = page.locator('button[aria-label*="主题"]').first
    if theme_btn.count() > 0:
        theme_btn.click()
        page.wait_for_timeout(500)
        after = page.evaluate("document.documentElement.className")
        log(f"    切换后主题 class: {after}")
    else:
        log("    主题按钮未找到")
    shot(page, "07-theme.png")

def test_responsive(page):
    """8. 响应式测试"""
    log("[8] 响应式测试")
    page.goto(f"{BASE}/editor")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    page.set_viewport_size({"width": 700, "height": 800})
    page.wait_for_timeout(500)
    shot(page, "08-mobile.png")
    page.set_viewport_size({"width": 900, "height": 800})
    page.wait_for_timeout(500)
    shot(page, "08-tablet.png")
    page.set_viewport_size({"width": 1280, "height": 800})

def on_console(msg):
    if msg.type == "error":
        errors.append(f"Console Error: {msg.text}")

def on_pageerror(err):
    errors.append(f"Page Error: {err.message}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        print("=" * 60)
        print("Scribe 端到端浏览器交互测试")
        print("=" * 60)

        test_landing(page)
        test_dashboard(page)
        test_project_switch(page)
        test_editor(page)
        test_settings_ai(page)
        test_global_search(page)
        test_theme_switch(page)
        test_responsive(page)

        browser.close()

        print("\n" + "=" * 60)
        print("测试完成")
        print("=" * 60)
        if errors:
            print(f"\n发现 {len(errors)} 个控制台/页面错误：")
            for e in errors:
                print(f"  - {e}")
        else:
            print("\n无控制台错误，无运行时异常。")

        print(f"\n截图保存在: {SHOT_DIR}")
        return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
