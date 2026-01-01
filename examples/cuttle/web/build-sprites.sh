#!/bin/bash
# Build card sprite sheets from SVG files
# Creates 1x (70x100) and 2x (140x200) versions

set -e

CARDS_DIR="cards"
TEMP_DIR="cards-temp"
OUTPUT_1X="cards-sprite.webp"
OUTPUT_2X="cards-sprite@2x.webp"

# Card dimensions
WIDTH_1X=70
HEIGHT_1X=100
WIDTH_2X=140
HEIGHT_2X=200

# Grid: 13 columns x 5 rows
# Row order: clubs, diamonds, hearts, spades, special
# Column order: ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, jack, queen, king

RANKS="ace 2 3 4 5 6 7 8 9 10 jack queen king"
SUITS="clubs diamonds hearts spades"

echo "Creating temporary PNG files..."

# Convert suit cards
for suit in $SUITS; do
  for rank in $RANKS; do
    svg_file="${CARDS_DIR}/${rank}_of_${suit}.svg"
    if [ -f "$svg_file" ]; then
      echo "Converting $svg_file..."
      magick "$svg_file" -resize ${WIDTH_2X}x${HEIGHT_2X} "${TEMP_DIR}/${rank}_of_${suit}.png"
    else
      echo "Warning: $svg_file not found"
    fi
  done
done

# Convert special cards (back, jokers)
echo "Converting back.svg..."
magick "${CARDS_DIR}/back.svg" -resize ${WIDTH_2X}x${HEIGHT_2X} "${TEMP_DIR}/back.png"

echo "Converting red_joker.svg..."
magick "${CARDS_DIR}/red_joker.svg" -resize ${WIDTH_2X}x${HEIGHT_2X} "${TEMP_DIR}/red_joker.png"

echo "Converting black_joker.svg..."
magick "${CARDS_DIR}/black_joker.svg" -resize ${WIDTH_2X}x${HEIGHT_2X} "${TEMP_DIR}/black_joker.png"

# Create transparent placeholder for empty cells
magick -size ${WIDTH_2X}x${HEIGHT_2X} xc:transparent "${TEMP_DIR}/empty.png"

echo "Assembling 2x sprite sheet..."

# Build the file list in correct order
FILES=""
for suit in $SUITS; do
  for rank in $RANKS; do
    FILES="$FILES ${TEMP_DIR}/${rank}_of_${suit}.png"
  done
done

# Add special row: back, red_joker, black_joker, then 10 empty slots
FILES="$FILES ${TEMP_DIR}/back.png ${TEMP_DIR}/red_joker.png ${TEMP_DIR}/black_joker.png"
for i in $(seq 1 10); do
  FILES="$FILES ${TEMP_DIR}/empty.png"
done

# Create 2x sprite sheet (13 columns)
magick montage $FILES -tile 13x5 -geometry ${WIDTH_2X}x${HEIGHT_2X}+0+0 -background transparent "${TEMP_DIR}/sprite-2x.png"

echo "Creating 2x WebP..."
magick "${TEMP_DIR}/sprite-2x.png" -quality 90 "$OUTPUT_2X"

echo "Creating 1x sprite sheet..."
magick "${TEMP_DIR}/sprite-2x.png" -resize 50% "${TEMP_DIR}/sprite-1x.png"
magick "${TEMP_DIR}/sprite-1x.png" -quality 90 "$OUTPUT_1X"

echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "Done! Created:"
ls -lh "$OUTPUT_1X" "$OUTPUT_2X"
