import re

def migrate_html(content):
    # 1. Update title
    content = content.replace("<title>Bumbledry PRO • Operations Platform</title>", 
                              "<title>Bumbledry PRO • Finora Operations Platform</title>")

    # 2. Update tailwind config
    old_tailwind_re = re.compile(r'tailwind\.config\s*=\s*\{.*?\};?\s*</script>', re.DOTALL)
    new_tailwind = """tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            finora: {
              forest: '#0D4735',
              'forest-dark': '#083426',
              'forest-light': '#165E47',
              green: '#00B261',
              mint: '#00D474',
              'mint-bg': '#EAF8F1',
              'mint-subtle': '#F0FAF5',
              app: '#F7FAF8',
              card: '#FFFFFF',
              subtle: '#F3F7F5',
              border: '#E7EFEA',
              main: '#11221B',
              secondary: '#586B63',
              muted: '#8E9F97',
              gold: '#E5A93C',
              red: '#E54B4B',
              blue: '#2E7CF6',
              purple: '#8E44AD',
            }
          },
          borderRadius: {
            'sm': '10px',
            'md': '14px',
            'lg': '20px',
            'xl': '20px',
            '2xl': '28px',
            'full': '9999px',
          },
          boxShadow: {
            'finora-card': '0 4px 20px rgba(13, 71, 53, 0.06)',
            'finora-elevation': '0 10px 30px rgba(13, 71, 53, 0.12)',
            'finora-dock': '0 -4px 20px rgba(0, 0, 0, 0.06)',
          }
        }
      }
    }
  </script>"""
    content = old_tailwind_re.sub(new_tailwind, content, count=1)

    # 3. Update style block with CSS variables and Finora classes
    style_replacement = """  <style>
    :root {
      /* Brand Colors */
      --finora-forest: #0D4735;
      --finora-forest-dark: #083426;
      --finora-forest-light: #165E47;
      --finora-green: #00B261;
      --finora-mint: #00D474;
      --finora-mint-bg: #EAF8F1;
      --finora-mint-subtle: #F0FAF5;
      
      /* Surfaces & Backgrounds */
      --bg-app: #F7FAF8;
      --bg-card: #FFFFFF;
      --bg-card-subtle: #F3F7F5;
      
      /* Typography Colors */
      --text-main: #11221B;
      --text-secondary: #586B63;
      --text-muted: #8E9F97;
      --text-white: #FFFFFF;
      
      /* Borders */
      --border-light: #E7EFEA;
      --border-focus: #00B261;
      
      /* Functional Accents */
      --gold-accent: #E5A93C;
      --red-accent: #E54B4B;
      --blue-accent: #2E7CF6;
      --purple-accent: #8E44AD;
      
      /* Gradients */
      --card-gradient: linear-gradient(135deg, #093729 0%, #0E4F3B 55%, #186E53 100%);
      
      /* Radii */
      --radius-full: 9999px;
      --radius-xl: 28px;
      --radius-lg: 20px;
      --radius-md: 14px;
      --radius-sm: 10px;
      
      /* Shadows */
      --shadow-card: 0 4px 20px rgba(13, 71, 53, 0.06);
      --shadow-elevation: 0 10px 30px rgba(13, 71, 53, 0.12);
      --shadow-tabbar: 0 -4px 20px rgba(0, 0, 0, 0.06);
      
      /* Fonts */
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      --font-mono: 'JetBrains Mono', SFMono-Regular, Menlo, monospace;
    }

    body {
      background-color: var(--bg-app);
      color: var(--text-main);
      font-family: var(--font-sans);
    }

    /* Finora Elevated Cards */
    .finora-card {
      background-color: #FFFFFF;
      border: 1px solid #E7EFEA;
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(13, 71, 53, 0.06);
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    }
    .finora-card-hover:hover {
      box-shadow: 0 10px 30px rgba(13, 71, 53, 0.12);
      transform: translateY(-1px);
    }

    /* Finora Hero Card Banner */
    .finora-hero-banner {
      background: linear-gradient(135deg, #093729 0%, #0E4F3B 55%, #186E53 100%);
      border-radius: 28px;
      box-shadow: 0 15px 35px rgba(13, 71, 53, 0.22);
      color: #FFFFFF;
      position: relative;
      overflow: hidden;
    }

    /* Finora Segmented Control */
    .finora-segmented-row {
      display: flex;
      background: #EAF8F1;
      padding: 4px;
      border-radius: 9999px;
      border: 1px solid #E7EFEA;
      gap: 4px;
    }

    /* Tactile Haptic Feel */
    button:active, .finora-btn:active {
      transform: scale(0.97);
    }

    @media print {
      body * {
        visibility: hidden;
      }
      #print-thermal-container, #print-thermal-container * {
        visibility: visible;
      }
      #print-thermal-container {
        position: absolute;
        left: 0;
        top: 0;
        width: 72mm;
        margin: 0;
        padding: 4mm;
        background: white;
        color: black;
        font-family: monospace;
      }
      .no-print {
        display: none !important;
      }
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #E7EFEA;
      border-radius: 9999px;
    }
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  </style>"""
    old_style_re = re.compile(r'<style>.*?</style>', re.DOTALL)
    content = old_style_re.sub(style_replacement, content, count=1)

    # 4. Color replacements
    color_map = [
        ('#003D29', '#0D4735'),
        ('#002B1D', '#083426'),
        ('#001810', '#083426'),
        ('#108910', '#00B261'),
        ('#0D720D', '#009E54'),
        ('#0A610A', '#0D4735'),
        ('#FAF1E5', '#EAF8F1'),
        ('#EFE9E1', '#E7EFEA'),
        ('#F7F5F0', '#F7FAF8'),
        ('#E8E8E3', '#E7EFEA'),
        ('#1D252C', '#11221B'),
        ('#72767E', '#586B63'),
        ('#E11900', '#E54B4B'),
        ('#FF7009', '#E5A93C'),
        ('#FFC043', '#E5A93C'),
        ('#FFB800', '#E5A93C'),
        ('#276EF1', '#2E7CF6'),
        ('#00AEEF', '#2E7CF6'),
    ]
    for old, new in color_map:
        content = content.replace(old, new)

    # 5. Insert Finora Hero Banner in Admin Overview
    # Find screen-admin and overview header
    target_overview = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">'
    hero_banner = """<!-- Finora Hero Operations Card Banner (28px Radius & 135deg Gradient) -->
      <div class="finora-hero-banner p-6 sm:p-7 rounded-[28px] text-white shadow-[0_15px_35px_rgba(13,71,53,0.22)] relative overflow-hidden mb-6" style="background: linear-gradient(135deg, #093729 0%, #0E4F3B 55%, #186E53 100%);">
        <div class="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#00D474]/10 blur-3xl pointer-events-none"></div>
        <div class="absolute right-1/3 -top-12 w-48 h-48 rounded-full bg-[#00B261]/15 blur-2xl pointer-events-none"></div>

        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-3">
            <div class="flex items-center space-x-2.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#00D474] bg-[#083426]/80 px-3 py-1 rounded-full border border-[#00D474]/30 flex items-center space-x-1.5 shadow-xs">
                <span class="w-2 h-2 rounded-full bg-[#00D474] animate-pulse"></span>
                <span>Finora Ops Active</span>
              </span>
              <span class="text-[11px] text-[#A7C2B6] font-mono">Amsterdam Operations Hub</span>
            </div>

            <div>
              <span class="text-xs font-semibold text-[#C1D7CD] uppercase tracking-wider block">Total Pipeline Garments</span>
              <div class="flex items-baseline space-x-3 mt-1">
                <span id="hero-stat-garments" class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">0 pcs</span>
                <span class="text-xs font-bold text-[#00D474] bg-[#083426]/90 px-2.5 py-1 rounded-full border border-[#00D474]/30 flex items-center space-x-1">
                  <i data-lucide="trending-up" class="w-3.5 h-3.5 text-[#00D474]"></i>
                  <span>+18.4% velocity</span>
                </span>
              </div>
            </div>
            
            <p class="text-xs text-[#C1D7CD] max-w-lg">
              High-velocity garment routing, automated shift accountability, and zero-emission e-cargo delivery across European corridors.
            </p>
          </div>

          <!-- Finora Quick Action Circular Buttons Grid -->
          <div class="flex items-center gap-3 shrink-0">
            <div class="flex flex-col items-center gap-1.5">
              <button onclick="openNewOrderModal()" class="w-12 h-12 rounded-full bg-[#00B261] hover:bg-[#00D474] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,178,97,0.35)] hover:scale-105 active:scale-95 transition-all" title="New Garment Intake">
                <i data-lucide="plus" class="w-5 h-5 text-white stroke-[2.5]"></i>
              </button>
              <span class="text-[11px] font-bold text-white">Intake</span>
            </div>

            <div class="flex flex-col items-center gap-1.5">
              <button onclick="openExcelUploadModal()" class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all" title="Import CSV">
                <i data-lucide="file-spreadsheet" class="w-5 h-5 text-[#00D474]"></i>
              </button>
              <span class="text-[11px] font-medium text-[#C1D7CD]">Import</span>
            </div>

            <div class="flex flex-col items-center gap-1.5">
              <button onclick="openCustomersDirectory()" class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all" title="2,000 Customers">
                <i data-lucide="users" class="w-5 h-5 text-[#00D474]"></i>
              </button>
              <span class="text-[11px] font-medium text-[#C1D7CD]">Directory</span>
            </div>

            <div class="flex flex-col items-center gap-1.5">
              <button onclick="refreshAll()" class="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all" title="Sync All">
                <i data-lucide="refresh-cw" class="w-5 h-5 text-[#C1D7CD]"></i>
              </button>
              <span class="text-[11px] font-medium text-[#C1D7CD]">Sync</span>
            </div>
          </div>
        </div>
      </div>

      <!-- High-level Metric Cards (Finora 20px Rounded Cards) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">"""

    content = content.replace('<!-- High-level Metric Cards (Uber Style) -->\n      ' + target_overview, hero_banner)

    # 6. Enhance card radius across the document:
    # Replace standard card containers with 20px / 28px
    content = content.replace('rounded-2xl border border-[#E7EFEA]', 'rounded-[20px] border border-[#E7EFEA] shadow-[0_4px_20px_rgba(13,71,53,0.06)]')
    content = content.replace('rounded-3xl border border-[#E7EFEA]', 'rounded-[28px] border border-[#E7EFEA] shadow-[0_4px_20px_rgba(13,71,53,0.06)]')

    return content

def migrate_js(content):
    # Color replacements in JS
    color_map = [
        ('#003D29', '#0D4735'),
        ('#002B1D', '#083426'),
        ('#001810', '#083426'),
        ('#108910', '#00B261'),
        ('#0D720D', '#009E54'),
        ('#0A610A', '#0D4735'),
        ('#FAF1E5', '#EAF8F1'),
        ('#EFE9E1', '#E7EFEA'),
        ('#F7F5F0', '#F7FAF8'),
        ('#E8E8E3', '#E7EFEA'),
        ('#1D252C', '#11221B'),
        ('#72767E', '#586B63'),
        ('#E11900', '#E54B4B'),
        ('#FF7009', '#E5A93C'),
        ('#FFC043', '#E5A93C'),
        ('#FFB800', '#E5A93C'),
        ('#276EF1', '#2E7CF6'),
        ('#00AEEF', '#2E7CF6'),
    ]
    for old, new in color_map:
        content = content.replace(old, new)

    # Ensure hero-stat-garments is updated in renderAdminOverview
    if "const heroEl = document.getElementById('hero-stat-garments');" not in content:
        content = content.replace(
            "if (revEl) revEl.innerText = `${totalPiecesInPipeline} pcs`;",
            "if (revEl) revEl.innerText = `${totalPiecesInPipeline} pcs`;\n  const heroEl = document.getElementById('hero-stat-garments');\n  if (heroEl) heroEl.innerText = `${totalPiecesInPipeline} pcs`;"
        )

    # In active tab styling, replace text-[#00B261] or old color with text-white on #0D4735
    content = content.replace("bg-[#0D4735] text-[#00B261]", "bg-[#0D4735] text-white shadow-[0_4px_12px_rgba(13,71,53,0.2)]")

    return content

with open('public/index.html') as f:
    orig_html = f.read()

new_html = migrate_html(orig_html)

with open('public/index.html', 'w') as f:
    f.write(new_html)

with open('public/app.js') as f:
    orig_js = f.read()

new_js = migrate_js(orig_js)

with open('public/app.js', 'w') as f:
    f.write(new_js)

print('Finora migration completed successfully.')
