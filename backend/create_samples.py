import os
from PIL import Image, ImageDraw
import pandas as pd

def create_sample_template():
    # Create a 1920x1080 certificate image with a stylish border
    width, height = 1920, 1080
    img = Image.new("RGB", (width, height), color="#0F172A") # Obsidian slate background
    draw = ImageDraw.Draw(img)
    
    # Outer border (Gold)
    draw.rectangle([40, 40, width - 40, height - 40], outline="#E2E8F0", width=4)
    # Inner border (Slimmer)
    draw.rectangle([55, 55, width - 55, height - 55], outline="#F59E0B", width=2)
    
    # Title text placeholder space
    # Draw certificate ornaments (some simple lines and shapes)
    draw.line([300, 250, 1620, 250], fill="#F59E0B", width=3)
    draw.line([450, 850, 1470, 850], fill="#F59E0B", width=1)
    
    # Save template
    template_path = os.path.join(os.path.dirname(__file__), "..", "sample_template.png")
    img.save(template_path)
    print(f"Sample template image created at: {os.path.abspath(template_path)}")

def create_sample_excel():
    data = [
        {"Full Name": "Sarah Connor", "Role": "Cyber Security Analyst", "Issue Date": "July 15, 2026", "Email": "sarah.connor@sky-net.io"},
        {"Full Name": "Marcus Wright", "Role": "DevOps Engineer", "Issue Date": "July 15, 2026", "Email": "marcus.wright@cyborg.org"},
        {"Full Name": "John Connor", "Role": "Resistance Leader", "Issue Date": "July 15, 2026", "Email": "john.connor@resistance.net"},
    ]
    df = pd.DataFrame(data)
    excel_path = os.path.join(os.path.dirname(__file__), "..", "sample_data.xlsx")
    df.to_excel(excel_path, index=False)
    print(f"Sample Excel data created at: {os.path.abspath(excel_path)}")

if __name__ == "__main__":
    create_sample_template()
    create_sample_excel()
