"""
视觉基线测试：捕获所有主要页面的当前状态，作为重构前后对比的基准。
"""
from playwright.sync_api import sync_playwright
import os

OUTPUT_DIR = 'test-screenshots/baseline-before'
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = 'http://localhost:8787'

PAGES = [
    ('landing', '/landing.html', None),
    ('dashboard', '/dashboard', None),
    ('projects', '/projects', None),
    ('editor', '/editor', None),
    ('characters', '/characters', None),
    ('worldview', '/worldview', None),
    ('scenes', '/scenes', None),
    ('plot', '/plot', None),
    ('inspiration', '/inspiration', None),
    ('settings-general', '/settings', '通用'),
    ('settings-appearance', '/settings', '外观'),
    ('settings-ai', '/settings', 'AI 大模型'),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        for name, path, tab in PAGES:
            print(f'  捕获: {name} ({path})')
            page.goto(BASE_URL + path, wait_until='networkidle')
            page.wait_for_timeout(800)

            if tab:
                # 点击对应 tab
                tab_btn = page.get_by_role('tab', name=tab)
                if tab_btn.is_visible():
                    tab_btn.click()
                    page.wait_for_timeout(400)

            page.screenshot(
                path=f'{OUTPUT_DIR}/{name}-light.png',
                full_page=True,
            )

            # 切换暗黑模式
            theme_btn = page.get_by_label('切换主题')
            if theme_btn.is_visible():
                theme_btn.click()
                page.wait_for_timeout(300)
                page.screenshot(
                    path=f'{OUTPUT_DIR}/{name}-dark.png',
                    full_page=True,
                )
                # 切回明亮模式
                theme_btn.click()
                page.wait_for_timeout(300)

        browser.close()
        print(f'\n基线截图已保存到 {OUTPUT_DIR}')


if __name__ == '__main__':
    main()
