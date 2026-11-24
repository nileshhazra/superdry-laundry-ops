import re

# Update public/index.html
with open('public/index.html') as f:
    html = f.read()

# Replace modal backdrops with emerald frosted glass
html = html.replace('bg-slate-900/50 backdrop-blur-sm', 'bg-[#0D4735]/60 backdrop-blur-[25px]')

# Replace neutral text
html = html.replace('text-neutral-400', 'text-[#C1D7CD]')
html = html.replace('text-neutral-500', 'text-[#586B63]')
html = html.replace('text-neutral-600', 'text-[#586B63]')

# Clean up redundant shadows in index.html
html = html.replace('shadow-[0_4px_20px_rgba(13,71,53,0.06)] shadow-xs', 'shadow-[0_4px_20px_rgba(13,71,53,0.06)]')
html = html.replace('shadow-[0_4px_20px_rgba(13,71,53,0.06)] shadow-sm', 'shadow-[0_4px_20px_rgba(13,71,53,0.06)]')
html = html.replace('shadow-[0_4px_20px_rgba(13,71,53,0.06)] shadow-md', 'shadow-[0_4px_20px_rgba(13,71,53,0.06)]')
html = html.replace('shadow-[0_4px_20px_rgba(13,71,53,0.06)] shadow-xl', 'shadow-[0_4px_20px_rgba(13,71,53,0.06)]')
html = html.replace('shadow-[0_4px_20px_rgba(13,71,53,0.06)] shadow-2xl', 'shadow-[0_4px_20px_rgba(13,71,53,0.06)]')

with open('public/index.html', 'w') as f:
    f.write(html)

# Update public/app.js
with open('public/app.js') as f:
    js = f.read()

# Update monitor tabs active class
js = js.replace(
    "btn.className = 'px-3 py-1.5 rounded-full text-xs font-bold bg-[#00B261] text-white shadow-xs flex items-center space-x-1 whitespace-nowrap';",
    "btn.className = 'px-3 py-1.5 rounded-full text-xs font-bold bg-[#0D4735] text-white shadow-[0_4px_12px_rgba(13,71,53,0.2)] flex items-center space-x-1 whitespace-nowrap';"
)

# Update washer mobile stage pills
js = js.replace(
    "pill.className = 'washer-stage-pill px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-sm shrink-0';",
    "pill.className = 'washer-stage-pill px-3 py-1.5 rounded-full text-xs font-bold bg-[#0D4735] text-white shadow-[0_4px_12px_rgba(13,71,53,0.2)] shrink-0';"
)
js = js.replace(
    "pill.className = 'washer-stage-pill px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shrink-0';",
    "pill.className = 'washer-stage-pill px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EAF8F1] border border-[#E7EFEA] text-[#586B63] hover:text-[#11221B] shrink-0';"
)

# Replace remaining slate references in app.js
js = js.replace('border-slate-400', 'border-[#E7EFEA]')
js = js.replace('text-slate-400', 'text-[#586B63]')
js = js.replace('text-teal-600', 'text-[#00B261]')
js = js.replace('hover:bg-slate-50', 'hover:bg-[#F0FAF5]')
js = js.replace('text-slate-900', 'text-[#11221B]')
js = js.replace('text-slate-500', 'text-[#586B63]')

# Clean up redundant shadows in app.js
js = js.replace("shadow-[0_4px_12px_rgba(13,71,53,0.2)] shadow-sm", "shadow-[0_4px_12px_rgba(13,71,53,0.2)]")

with open('public/app.js', 'w') as f:
    f.write(js)

print('Refinements applied successfully.')
