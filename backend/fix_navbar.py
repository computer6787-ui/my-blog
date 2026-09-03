import sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
idx = content.find("avatar.classList.remove('hidden')")
if idx >= 0:
    print(repr(content[idx:idx+800]))
else:
    print('NOT FOUND')
