"""
pdf_generator.py
Renders certificate PDFs by overlaying text fields onto a template image.

Design decisions:
- No network calls at render time. Fonts must exist in backend/fonts/ or be
  referenced by absolute path. Missing fonts raise FileNotFoundError.
- Text is centered inside each field's bounding box (anchor="mm").
- Auto-fit: font size is reduced from max_size down to min_size until the
  rendered text width fits inside the field's box width.
- Per-field format transforms are applied before font-fitting, so the
  transformed string is what the auto-fit algorithm sizes against.
"""

import os
import json
from typing import List, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont

# ── Font resolution ────────────────────────────────────────────────────────────
FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")
WINDOWS_FONTS_DIR = r"C:\Windows\Fonts"


def resolve_font_path(font_name: str) -> str:
    """
    Resolve font_name to an absolute .ttf path without loading it yet.
    Search order:
      1. Absolute path provided directly
      2. backend/fonts/<basename>
      3. C:\\Windows\\Fonts\\<basename>

    Raises FileNotFoundError with a clear message if not found.
    Never downloads anything from the network.
    """
    if not font_name:
        font_name = "Roboto-Regular.ttf"

    # 1. Already an absolute path
    if os.path.isabs(font_name) and os.path.exists(font_name):
        return font_name

    basename = os.path.basename(font_name)

    # 2. backend/fonts/
    local_path = os.path.join(FONTS_DIR, basename)
    if os.path.exists(local_path):
        return local_path

    # 3. Windows system fonts
    win_path = os.path.join(WINDOWS_FONTS_DIR, basename)
    if os.path.exists(win_path):
        return win_path

    raise FileNotFoundError(
        f"Font '{font_name}' not found. "
        f"Place the .ttf file in {FONTS_DIR} and try again."
    )


def load_font(font_name: str, size: int) -> ImageFont.FreeTypeFont:
    """Load a font at the given pixel size. Raises if font is missing."""
    path = resolve_font_path(font_name)
    return ImageFont.truetype(path, size)


# ── Value formatters ───────────────────────────────────────────────────────────

_ROMAN_VALS = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
    (100,  "C"), (90,  "XC"), (50,  "L"), (40,  "XL"),
    (10,   "X"), (9,   "IX"), (5,   "V"), (4,   "IV"), (1, "I"),
]


def _to_roman(n: int) -> str:
    """Convert a positive integer (1–3999) to a Roman numeral string."""
    if not (1 <= n <= 3999):
        raise ValueError(f"Roman numeral conversion requires 1 ≤ n ≤ 3999, got {n}")
    result = []
    for value, numeral in _ROMAN_VALS:
        while n >= value:
            result.append(numeral)
            n -= value
    return "".join(result)


def _to_ordinal(n: int) -> str:
    """Convert an integer to its English ordinal string (e.g. 1→'1st', 11→'11th')."""
    abs_n = abs(n)
    # 11, 12, 13 always use 'th' regardless of last digit
    if 11 <= (abs_n % 100) <= 13:
        suffix = "th"
    else:
        last = abs_n % 10
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(last, "th")
    return f"{n}{suffix}"


def apply_format(raw_value: str, format_type: str, format_config: str | None) -> Tuple[str, str | None]:
    """
    Apply a deterministic format transform to raw_value.

    Returns:
        (transformed_value, warning_message)
        warning_message is None on success, or a human-readable string when
        a custom_map lookup fails (the raw value is returned as-is in that case).

    Raises:
        ValueError: for invalid roman_numeral / ordinal inputs (caller decides
                    whether to propagate or fall back).
    """
    ft = (format_type or "as_is").strip().lower()

    if ft == "as_is" or ft == "":
        return raw_value, None

    if ft == "uppercase":
        return raw_value.upper(), None

    if ft == "title_case":
        return raw_value.title(), None

    if ft == "roman_numeral":
        try:
            n = int(float(raw_value))
            return _to_roman(n), None
        except (ValueError, TypeError):
            raise ValueError(
                f"roman_numeral format requires an integer value; got '{raw_value}'"
            )

    if ft == "ordinal":
        try:
            n = int(float(raw_value))
            return _to_ordinal(n), None
        except (ValueError, TypeError):
            raise ValueError(
                f"ordinal format requires an integer value; got '{raw_value}'"
            )

    if ft == "custom_map":
        mapping: dict = {}
        if format_config:
            try:
                mapping = json.loads(format_config)
            except json.JSONDecodeError:
                return raw_value, f"[FORMAT WARNING] custom_map config is not valid JSON; used raw value '{raw_value}'"

        str_key = str(raw_value).strip()
        if str_key in mapping:
            return str(mapping[str_key]), None
        else:
            return raw_value, (
                f"[FORMAT WARNING] custom_map: no mapping found for value '{raw_value}'; "
                f"used raw value. Available keys: {list(mapping.keys())}"
            )

    # Unknown format type — pass through silently
    return raw_value, None


# ── Auto-fit ──────────────────────────────────────────────────────────────────
def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    box_width: int,
    font_path: str,
    max_size: int = 48,
    min_size: int = 18,
) -> ImageFont.FreeTypeFont:
    """
    Return an ImageFont sized so that `text` fits within `box_width` pixels.
    Starts at max_size and steps down by 1 until the text width <= box_width.
    If text still overflows at min_size, returns the min_size font (slight overflow
    is acceptable; clipping is not).
    """
    for size in range(max_size, min_size - 1, -1):
        font = load_font(font_path, size)
        try:
            w = draw.textlength(text, font=font)
        except AttributeError:
            # Pillow < 9.2 fallback
            w = draw.textsize(text, font=font)[0]
        if w <= box_width:
            return font
    # Still too wide at min_size — return min and let it overflow slightly
    return load_font(font_path, min_size)


# ── Main render function ───────────────────────────────────────────────────────
def overlay_text_and_generate_pdf(
    template_path: str,
    fields: List[Dict[str, Any]],
    row_data: Dict[str, Any],
    output_pdf_path: str,
) -> List[str]:
    """
    Overlay field values onto the template image and save as PDF.

    Field dict keys:
        placeholder   : str  — variable name matching row_data column (case-insensitive)
        x             : int  — left edge of field box in original-image pixels
        y             : int  — top edge of field box in original-image pixels
        width         : int  — box width in pixels  (used for centering + auto-fit)
        height        : int  — box height in pixels (used for vertical centering)
        font_size     : int  — maximum font size; auto-fit may reduce it
        font_path     : str  — font file name (resolved via resolve_font_path)
        font_color    : str  — CSS hex color, e.g. "#000000"
        format_type   : str  — transform identifier (as_is, roman_numeral, ordinal, …)
        format_config : str  — optional JSON for custom_map

    row_data: dict of Excel column values for this row.

    Returns:
        List of warning strings (empty list = no warnings). Warnings are
        non-fatal — the PDF is still generated with the raw value.
    """
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template image not found: {template_path}")

    # Case-insensitive row lookup
    normalized_row: Dict[str, str] = {
        str(k).strip().lower(): str(v) for k, v in row_data.items()
    }

    with Image.open(template_path) as img:
        canvas = img.copy()

    draw = ImageDraw.Draw(canvas)
    warnings: List[str] = []

    for field in fields:
        placeholder: str = field.get("placeholder", "").strip()
        norm_key = placeholder.lower()

        # ── Retrieve text value with multi-strategy matching ─────────────────
        # Strategy 1: exact case-insensitive match ("Full Name" == "full name")
        text_value: str = normalized_row.get(norm_key, "")

        if not text_value:
            # Strategy 2: try stripping whitespace on raw keys
            for raw_k, raw_v in row_data.items():
                if str(raw_k).strip().lower() == norm_key:
                    text_value = str(raw_v)
                    break

        if not text_value:
            # Strategy 3: word-level partial match
            # e.g. field "Full Name" matches column "Name", or field "Name" matches "Full Name"
            norm_words = set(norm_key.split())
            for col_k, col_v in normalized_row.items():
                col_words = set(col_k.split())
                # Check if one is a subset of the other (e.g. {"name"} ⊆ {"full","name"})
                if norm_words & col_words:  # any word overlap
                    text_value = str(col_v)
                    warnings.append(
                        f"Field '{placeholder}': column name fuzzy-matched to '{col_k}' "
                        f"(rename field to match Excel column exactly to silence this warning)."
                    )
                    break

        if not text_value:
            # Strategy 4: substring match — field key is contained in column key or vice versa
            for col_k, col_v in normalized_row.items():
                if norm_key in col_k or col_k in norm_key:
                    text_value = str(col_v)
                    warnings.append(
                        f"Field '{placeholder}': column name substring-matched to '{col_k}'."
                    )
                    break


        if not text_value:
            continue  # Skip fields with no data — don't draw empty strings

        # ── Apply format transform before sizing ──────────────────────────────
        fmt_type: str = field.get("format_type", "as_is") or "as_is"
        fmt_config: str | None = field.get("format_config")
        try:
            text_value, warning = apply_format(text_value, fmt_type, fmt_config)
            if warning:
                warnings.append(f"Field '{placeholder}': {warning}")
        except ValueError as fmt_err:
            # Hard format error (e.g. roman_numeral on non-integer) — flag as warning,
            # fall back to raw value so the PDF still generates.
            warnings.append(
                f"Field '{placeholder}': [FORMAT WARNING] {fmt_err}; used raw value."
            )

        x: int = int(field.get("x", 0))
        y: int = int(field.get("y", 0))
        box_width: int = int(field.get("width", 400))
        box_height: int = int(field.get("height", 60))
        max_font_size: int = int(field.get("font_size", 48))
        font_file: str = field.get("font_filename") or field.get("font_path") or "Roboto-Regular.ttf"
        color: str = field.get("font_color", "#000000")

        vertical_offset: int = int(field.get("vertical_offset", 0))

        # Resolve font with auto-fit against the *transformed* string
        try:
            font = fit_font(
                draw,
                text_value,
                box_width,
                font_file,
                max_size=max_font_size,
                min_size=18,
            )
        except FileNotFoundError as e:
            # Hard failure with a descriptive message — no silent fallback
            raise RuntimeError(f"Cannot render field '{placeholder}': {e}") from e

        # Mathematically center the text bounding box within the field box
        try:
            # Pillow >= 8.0.0
            l, t, r, b = font.getbbox(text_value)
            text_w = r - l
            text_h = b - t
            # Align centers: box center must equal text bounding box center
            draw_x = x + (box_width - text_w) // 2 - l
            draw_y = y + (box_height - text_h) // 2 - t + vertical_offset
        except AttributeError:
            # Fallback for very old Pillow versions
            try:
                text_w, text_h = draw.textsize(text_value, font=font)
            except AttributeError:
                text_w = draw.textlength(text_value, font=font)
                text_h = max_font_size
            draw_x = x + (box_width - text_w) // 2
            draw_y = y + (box_height - text_h) // 2 + vertical_offset

        # Draw the text at (draw_x, draw_y) with default top-left anchor
        try:
            draw.text((draw_x, draw_y), text_value, fill=color, font=font)
        except Exception as e:
            print(f"[pdf_generator] Error drawing field '{placeholder}': {e}. Using black fallback.")
            try:
                draw.text((draw_x, draw_y), text_value, fill="#000000", font=font)
            except Exception:
                pass

    # PDF requires RGB (no alpha channel)
    pdf_canvas = canvas.convert("RGB")
    pdf_dir = os.path.dirname(output_pdf_path)
    if pdf_dir:
        os.makedirs(pdf_dir, exist_ok=True)
    pdf_canvas.save(output_pdf_path, "PDF", resolution=100.0)

    return warnings
