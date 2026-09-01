import os
css_path = 'backend/static/css/style.css'
print(f"File exists: {os.path.exists(css_path)}")
print(f"File size: {os.path.getsize(css_path)} bytes")
print(f"First 100 chars: {open(css_path).read()[:100]!r}")
print(f"Last 100 chars: {open(css_path).read()[-100:]!r}")
