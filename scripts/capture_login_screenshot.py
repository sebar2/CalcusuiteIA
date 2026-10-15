import os
import shutil
import threading
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from playwright.sync_api import sync_playwright

PORT = 5199

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.abspath('frontend/dist'), **kwargs)

def start_server():
    with TCPServer(('127.0.0.1', PORT), Handler) as httpd:
        httpd.serve_forever()

def main():
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    print(f"Static server running on http://127.0.0.1:{PORT}")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1600, 'height': 950})
        page = context.new_page()
        page.goto(f'http://127.0.0.1:{PORT}')
        page.wait_for_timeout(2000)

        # Clear any stored session
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        page.reload()
        page.wait_for_timeout(2000)

        # Fill demo credentials for realistic display
        user_input = page.locator('input[type="text"]').first
        if user_input.is_visible():
            user_input.fill('demo')

        pass_input = page.locator('input[type="password"]').first
        if pass_input.is_visible():
            pass_input.fill('demo123')

        page.wait_for_timeout(1000)

        dest1 = os.path.abspath('docs/screenshots/00_login_portal_acceso.png')
        page.screenshot(path=dest1)

        dest2 = r'C:\Users\sebar\.gemini\antigravity\brain\2570fc9f-a035-4b13-ac76-8986765a3a5a\00_login_portal_acceso.png'
        shutil.copy2(dest1, dest2)
        print('Screenshot 00_login_portal_acceso.png captured and saved successfully!')
        browser.close()

if __name__ == '__main__':
    main()
