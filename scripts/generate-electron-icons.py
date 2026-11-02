from PIL import Image
import os

def generate_icons():
    img_path = os.path.join('public', 'sterling-favicon.png')
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return

    img = Image.open(img_path).convert('RGBA')
    size = 512
    padding = 32
    target_inner = size - (padding * 2)

    w, h = img.size
    ratio = min(target_inner / w, target_inner / h)
    new_w = int(w * ratio)
    new_h = int(h * ratio)

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 512x512 transparent canvas
    square_img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    square_img.paste(resized, (offset_x, offset_y), resized)

    assets_dir = os.path.join('electron', 'assets')
    os.makedirs(assets_dir, exist_ok=True)

    png_path = os.path.join(assets_dir, 'icon.png')
    ico_path = os.path.join(assets_dir, 'icon.ico')

    square_img.save(png_path, format='PNG')
    square_img.save(ico_path, format='ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    print(f"Generated {png_path} and {ico_path} successfully.")

if __name__ == '__main__':
    generate_icons()

