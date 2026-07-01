"""
主题系统回归测试：验证 4 种主题组合的视觉效果
- 蓝调明亮 (theme-blue.theme-light)
- 蓝调暗黑 (theme-blue.theme-dark)
- 朱砂红明亮 (theme-vermilion.theme-light)
- 朱砂红暗黑 (theme-vermilion.theme-dark)
"""
from playwright.sync_api import sync_playwright
import os

BASE_URL = 'http://localhost:5173'
OUTPUT_DIR = 'test-screenshots/theme-verify'

os.makedirs(OUTPUT_DIR, exist_ok=True)

PAGES = [
    ('projects', '/projects', None),
    ('settings', '/settings', None),
    ('characters', '/characters', None),
    ('scenes', '/scenes', None),
    ('inspiration', '/inspiration', None),
]

THEMES = [
    ('blue-light', 'blue', 'light'),
    ('blue-dark', 'blue', 'dark'),
    ('vermilion-light', 'vermilion', 'light'),
    ('vermilion-dark', 'vermilion', 'dark'),
]


def apply_theme(page, color_theme: str, mode: str):
    """通过 DOM classList 设置主题"""
    page.evaluate(f"""
        document.documentElement.classList.remove('theme-blue', 'theme-vermilion', 'theme-light', 'theme-dark');
        document.documentElement.classList.add('theme-{color_theme}', 'theme-{mode}');
    """)
    page.wait_for_timeout(300)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        for theme_name, color_theme, mode in THEMES:
            theme_dir = f'{OUTPUT_DIR}/{theme_name}'
            os.makedirs(theme_dir, exist_ok=True)
            print(f'\n=== Theme: {theme_name} ===')

            for name, path, tab in PAGES:
                try:
                    page.goto(BASE_URL + path, wait_until='networkidle', timeout=15000)
                    apply_theme(page, color_theme, mode)
                    page.wait_for_timeout(200)
                    page.screenshot(path=f'{theme_dir}/{name}.png', full_page=True)
                    print(f'  ✓ {name}')
                except Exception as e:
                    print(f'  ✗ {name}: {e}')

        browser.close()
        print(f'\n✅ 主题验证截图已保存到 {OUTPUT_DIR}/')


if __name__ == '__main__':
    main()
