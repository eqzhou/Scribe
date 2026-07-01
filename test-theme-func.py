"""
主题系统功能测试：验证设置页主题切换交互
"""
from playwright.sync_api import sync_playwright

BASE_URL = 'http://localhost:5173'


def test_theme_switching():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(BASE_URL + '/settings', wait_until='networkidle')
        page.wait_for_timeout(1000)

        # 点击外观 Tab
        page.click('button:has-text("外观")')
        page.wait_for_timeout(500)

        # 验证初始主题：蓝调 + 明亮
        html_class = page.evaluate('document.documentElement.className')
        print(f'初始 class: {html_class}')
        assert 'theme-blue' in html_class, '默认应该是蓝调主题'
        assert 'theme-light' in html_class, '默认应该是明亮模式'
        print('✓ 默认主题正确')

        # 切换到朱砂红
        page.click('text=朱砂红')
        page.wait_for_timeout(500)
        html_class = page.evaluate('document.documentElement.className')
        print(f'切换朱砂红后 class: {html_class}')
        assert 'theme-vermilion' in html_class, '切换后应该是朱砂红主题'
        assert 'theme-blue' not in html_class, '应该移除蓝调主题'
        print('✓ 朱砂红主题切换正确')

        # 切换到暗黑模式
        page.click('text=暗黑')
        page.wait_for_timeout(500)
        html_class = page.evaluate('document.documentElement.className')
        print(f'切换暗黑后 class: {html_class}')
        assert 'theme-dark' in html_class, '切换后应该是暗黑模式'
        assert 'theme-light' not in html_class, '应该移除明亮模式'
        assert 'theme-vermilion' in html_class, '朱砂红主题应该保持'
        print('✓ 暗黑模式切换正确')

        # 切换回蓝调 + 明亮
        page.click('text=蓝调')
        page.wait_for_timeout(300)
        page.click('text=明亮')
        page.wait_for_timeout(300)
        html_class = page.evaluate('document.documentElement.className')
        print(f'恢复后 class: {html_class}')
        assert 'theme-blue' in html_class
        assert 'theme-light' in html_class
        print('✓ 恢复默认主题正确')

        # 验证 localStorage 持久化
        stored = page.evaluate('localStorage.getItem("scribe-ui")')
        print(f'localStorage: {stored[:100]}...')
        assert 'blue' in stored and 'light' in stored, '主题应该持久化到 localStorage'
        print('✓ 主题持久化正确')

        print('\n🎉 所有主题功能测试通过！')
        page.wait_for_timeout(1000)
        browser.close()


if __name__ == '__main__':
    test_theme_switching()
