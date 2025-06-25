#!/bin/sh

# Output file
OUTPUT_FILE="merged_output.txt"

# Clear output file if it exists
> "$OUTPUT_FILE"

# Find and process .js and .ejs files under 30 KB excluding node_modules
find . -type f \( -name "*.js" -o -name "*.ejs" \) ! -path "*/node_modules/*" -size -30k | while IFS= read -r file
do
  echo "===== $file =====" >> "$OUTPUT_FILE"
  cat "$file" >> "$OUTPUT_FILE"
  echo "\n" >> "$OUTPUT_FILE"
done

echo "Done. Contents saved in $OUTPUT_FILE"

