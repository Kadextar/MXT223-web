from PIL import Image
import os

# Input path (matches the artifact path from previous step)
INPUT_PATH = "/Users/azamatsatullaev/.gemini/antigravity/brain/d7564e10-9fe2-4c00-b28b-bfd16da1a383/memoji_avatar_set_1769800765787.png"
OUTPUT_DIR = "web/static/avatars"

def split_avatars():
    if not os.path.exists(INPUT_PATH):
        print(f"Error: Input file not found at {INPUT_PATH}")
        return

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    img = Image.open(INPUT_PATH)
    width, height = img.size
    
    # 3x3 grid
    cell_width = width // 3
    cell_height = height // 3
    
    count = 1
    for r in range(3):
        for c in range(3):
            left = c * cell_width
            upper = r * cell_height
            right = left + cell_width
            lower = upper + cell_height
            
            # Crop
            avatar = img.crop((left, upper, right, lower))
            
            # Resize to standard size (e.g. 256x256) for consistency and smaller size
            avatar = avatar.resize((256, 256), Image.Resampling.LANCZOS)
            
            # Save
            output_path = os.path.join(OUTPUT_DIR, f"{count}.png")
            avatar.save(output_path)
            print(f"Saved {output_path}")
            count += 1

if __name__ == "__main__":
    split_avatars()
