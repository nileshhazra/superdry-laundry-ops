from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

def create_macos_window(screenshot_path, output_path, url="https://bumbledry.ops/amsterdam", title="Bumbledry PRO • European Operations"):
    # Load screenshot
    img = Image.open(screenshot_path).convert("RGBA")
    w, h = img.size
    
    title_bar_height = 42
    border_radius = 12
    margin = 20  # Margin for drop shadow
    
    window_w = w
    window_h = h + title_bar_height
    
    canvas_w = window_w + margin * 2
    canvas_h = window_h + margin * 2
    
    # 1. Create window image
    window = Image.new("RGBA", (window_w, window_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(window)
    
    # Draw title bar
    # Top rounded rectangle for title bar
    draw.rounded_rectangle(
        [(0, 0), (window_w, window_h)],
        radius=border_radius,
        fill=(255, 255, 255, 255),
        outline=(209, 213, 219, 255),
        width=1
    )
    
    # Fill title bar area with light gray
    title_bar = Image.new("RGBA", (window_w, title_bar_height), (243, 244, 246, 255))
    tb_draw = ImageDraw.Draw(title_bar)
    
    # Traffic lights (red, yellow, green)
    tl_y = title_bar_height // 2
    tb_draw.ellipse([(18, tl_y - 6), (30, tl_y + 6)], fill=(255, 95, 86, 255))  # Red
    tb_draw.ellipse([(38, tl_y - 6), (50, tl_y + 6)], fill=(255, 189, 46, 255)) # Yellow
    tb_draw.ellipse([(58, tl_y - 6), (70, tl_y + 6)], fill=(39, 201, 63, 255))  # Green
    
    # URL Capsule in center
    capsule_w = 440
    capsule_h = 24
    cx1 = (window_w - capsule_w) // 2
    cy1 = (title_bar_height - capsule_h) // 2
    cx2 = cx1 + capsule_w
    cy2 = cy1 + capsule_h
    
    tb_draw.rounded_rectangle(
        [(cx1, cy1), (cx2, cy2)],
        radius=6,
        fill=(255, 255, 255, 255),
        outline=(229, 231, 235, 255),
        width=1
    )
    
    # URL Text
    try:
        font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 11)
    except:
        font = ImageFont.load_default()
        
    url_text = f"🔒  {url}"
    tb_draw.text((cx1 + 12, cy1 + 5), url_text, fill=(75, 85, 99, 255), font=font)
    
    # Divider line under title bar
    tb_draw.line([(0, title_bar_height - 1), (window_w, title_bar_height - 1)], fill=(229, 231, 235, 255), width=1)
    
    # Paste title bar onto window
    window.paste(title_bar, (0, 0))
    
    # Paste screenshot below title bar
    window.paste(img, (0, title_bar_height))
    
    # Apply rounded corners mask to whole window
    mask = Image.new("L", (window_w, window_h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (window_w, window_h)], radius=border_radius, fill=255)
    
    # Border stroke on top
    window_with_mask = Image.new("RGBA", (window_w, window_h), (0, 0, 0, 0))
    window_with_mask.paste(window, (0, 0), mask=mask)
    
    # 2. Drop Shadow Canvas
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    
    # Shadow mask
    shadow_mask = Image.new("RGBA", (window_w, window_h), (0, 0, 0, 80))
    shadow_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    shadow_canvas.paste(shadow_mask, (margin, margin + 4), mask=mask)
    shadow_blurred = shadow_canvas.filter(ImageFilter.GaussianBlur(14))
    
    # Composite: shadow + window
    canvas.paste(shadow_blurred, (0, 0), mask=shadow_blurred)
    canvas.paste(window_with_mask, (margin, margin), mask=window_with_mask)
    
    # Save optimized PNG
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    print(f"Created macOS framed screenshot: {output_path}")

if __name__ == "__main__":
    print("macos_window_generator ready.")
