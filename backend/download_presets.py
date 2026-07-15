import os
import urllib.request
import urllib.error

FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")
os.makedirs(FONTS_DIR, exist_ok=True)

FONTS_TO_DOWNLOAD = {
    "PlayfairDisplay-Regular.ttf": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf"
    ],
    "CormorantGaramond-Regular.ttf": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
    ],
    "Montserrat-Regular.ttf": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
    ],
    "DancingScript-Regular.ttf": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf"
    ],
    "GreatVibes-Regular.ttf": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf"
    ],
    "EBGaramond-Regular.ttf": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf"
    ]
}

def download_font(name, urls):
    dest_path = os.path.join(FONTS_DIR, name)
    if os.path.exists(dest_path):
        print(f"[PRESETS] Font '{name}' already exists. Skipping.")
        return True

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    for url in urls:
        print(f"[PRESETS] Attempting to download '{name}' from: {url}")
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as response:
                with open(dest_path, "wb") as f:
                    f.write(response.read())
            print(f"[PRESETS] Successfully downloaded '{name}'.")
            return True
        except urllib.error.HTTPError as e:
            print(f"[PRESETS] HTTP Error {e.code} for: {url}")
        except Exception as e:
            print(f"[PRESETS] Error: {e}")

    print(f"[PRESETS] FAILED to download '{name}' after trying all options.")
    return False

if __name__ == "__main__":
    success_count = 0
    for name, urls in FONTS_TO_DOWNLOAD.items():
        if download_font(name, urls):
            success_count += 1
            
    print(f"[PRESETS] Completed. Successfully downloaded {success_count}/{len(FONTS_TO_DOWNLOAD)} fonts.")
