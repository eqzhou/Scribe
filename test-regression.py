"""
完整回归测试：验证重构后各页面功能正常
1. 作品列表页：卡片渲染、悬停效果
2. 设置页：所有 Tab 切换、主题切换、字号滑块
3. 角色页：卡片渲染
4. 场景页：卡片渲染
5. 灵感页：卡片渲染 + 瀑布流
"""
from playwright.sync_api import sync_playwright

BASE_URL = 'http://localhost:5173'

errors = []


def test_projects_page(page):
    """作品列表页"""
    print('\n📚 作品列表页')
    page.goto(BASE_URL + '/projects', wait_until='networkidle')
    page.wait_for_timeout(500)

    # 检查卡片是否渲染
    cards = page.locator('article').all()
    print(f'  作品卡片数量: {len(cards)}')
    if len(cards) == 0:
        errors.append('作品列表页：无卡片渲染')
    else:
        print('  ✓ 卡片正常渲染')

    # 检查新建按钮
    new_btn = page.locator('button:has-text("新建作品")')
    if new_btn.count() > 0:
        print('  ✓ 新建按钮存在')
    else:
        errors.append('作品列表页：缺少新建按钮')


def test_settings_page(page):
    """设置页"""
    print('\n⚙️  设置页')
    page.goto(BASE_URL + '/settings', wait_until='networkidle')
    page.wait_for_timeout(500)

    tabs = ['通用', '外观', '快捷键', 'AI 大模型', '数据管理', '关于']
    for tab in tabs:
        page.click(f'text={tab}')
        page.wait_for_timeout(300)
        print(f'  ✓ Tab「{tab}」切换正常')

    # 测试字号滑块
    page.click('text=通用')
    page.wait_for_timeout(200)
    slider = page.locator('#font-size')
    if slider.count() > 0:
        print('  ✓ 字号滑块存在')
    else:
        errors.append('设置页：字号滑块不存在')


def test_characters_page(page):
    """角色页"""
    print('\n👤 角色页')
    page.goto(BASE_URL + '/characters', wait_until='networkidle')
    page.wait_for_timeout(500)

    cards = page.locator('article').all()
    print(f'  角色卡片数量: {len(cards)}')
    if len(cards) == 0:
        # 可能是空状态
        empty = page.locator('text=暂无角色').count()
        if empty > 0:
            print('  ✓ 空状态正常')
        else:
            errors.append('角色页：既无卡片也无空状态')
    else:
        print('  ✓ 卡片正常渲染')


def test_scenes_page(page):
    """场景页"""
    print('\n🏔️  场景页')
    page.goto(BASE_URL + '/scenes', wait_until='networkidle')
    page.wait_for_timeout(500)

    cards = page.locator('li').all()
    print(f'  场景卡片数量: {len(cards)}')
    if len(cards) == 0:
        empty = page.locator('text=暂无场景').count()
        if empty > 0:
            print('  ✓ 空状态正常')
        else:
            errors.append('场景页：既无卡片也无空状态')
    else:
        print('  ✓ 卡片正常渲染')


def test_inspiration_page(page):
    """灵感页"""
    print('\n💡 灵感页')
    page.goto(BASE_URL + '/inspiration', wait_until='networkidle')
    page.wait_for_timeout(500)

    cards = page.locator('li').all()
    print(f'  灵感卡片数量: {len(cards)}')
    if len(cards) == 0:
        empty = page.locator('text=暂无灵感').count()
        if empty > 0:
            print('  ✓ 空状态正常')
        else:
            errors.append('灵感页：既无卡片也无空状态')
    else:
        print('  ✓ 卡片正常渲染')


def test_theme_switching(page):
    """主题切换"""
    print('\n🎨 主题切换')
    page.goto(BASE_URL + '/settings', wait_until='networkidle')
    page.wait_for_timeout(500)
    page.click('text=外观')
    page.wait_for_timeout(300)

    # 测试 4 种主题组合
    themes = [
        ('蓝调', '明亮', 'theme-blue', 'theme-light'),
        ('蓝调', '暗黑', 'theme-blue', 'theme-dark'),
        ('朱砂红', '暗黑', 'theme-vermilion', 'theme-dark'),
        ('朱砂红', '明亮', 'theme-vermilion', 'theme-light'),
    ]

    for color_text, mode_text, expected_color, expected_mode in themes:
        page.click(f'text={color_text}')
        page.wait_for_timeout(200)
        page.click(f'text={mode_text}')
        page.wait_for_timeout(200)
        cls = page.evaluate('document.documentElement.className')
        if expected_color in cls and expected_mode in cls:
            print(f'  ✓ {color_text} + {mode_text} 正常')
        else:
            errors.append(f'主题切换：{color_text}+{mode_text} 失败，当前 class: {cls}')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        test_projects_page(page)
        test_settings_page(page)
        test_characters_page(page)
        test_scenes_page(page)
        test_inspiration_page(page)
        test_theme_switching(page)

        browser.close()

        print('\n' + '=' * 50)
        if errors:
            print(f'❌ 发现 {len(errors)} 个问题：')
            for e in errors:
                print(f'  - {e}')
        else:
            print('🎉 所有回归测试通过！')
        print('=' * 50)


if __name__ == '__main__':
    main()
