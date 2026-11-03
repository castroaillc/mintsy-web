#!/usr/bin/env python3
"""Generates the dev and preview icons from the production ones, with a labelled band. Needs Pillow; run from apps/mobile."""
from PIL import Image, ImageDraw, ImageFont

FONT = 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'
INK = '#181626'
VARIANTS = [('dev', 'DEV', '#FFC23D'), ('preview', 'PREVIEW', '#45C4F9')]


def band(image, label, color, top, bottom, text_width):
    """Draws a full-width band from `top` to `bottom`, with the label fitted to at most `text_width` px."""
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, top, image.width, bottom), fill=color)
    size = int((bottom - top) * 0.62)
    font = ImageFont.truetype(FONT, size)
    while draw.textlength(label, font=font) > text_width:
        size -= 1
        font = ImageFont.truetype(FONT, size)
    draw.text((image.width / 2, (top + bottom) / 2), label, font=font, fill=INK, anchor='mm')


for name, label, color in VARIANTS:
    icon = Image.open('assets/images/icon.png').convert('RGB')  # App Store icons have no alpha
    band(icon, label, color, 756, 1024, 800)
    icon.save(f'assets/images/icon-{name}.png', optimize=True)

    # Adaptive layers are masked to about the middle two thirds, so the band sits inside that and the label stays narrow
    foreground = Image.open('assets/images/android-icon-foreground.png').convert('RGBA')
    band(foreground, label, color, 332, 396, 170)
    foreground.save(f'assets/images/android-icon-foreground-{name}.png', optimize=True)
