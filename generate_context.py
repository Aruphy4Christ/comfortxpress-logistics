from markitdown import MarkItDown
from pathlib import Path

md = MarkItDown()
output_filename = "ComfortXpress_Project_Context.md"

# Extensions you want to include
include_extensions = {'.js', '.json', '.html', '.css', '.ejs', '.jsx'}

with open(output_filename, 'w', encoding='utf-8') as outfile:
    for path in Path('.').rglob('*'):
        # Filter out sensitive or unnecessary folders/files
        if path.name == '.env' or 'node_modules' in path.parts or '.git' in path.parts or path.name == output_filename:
            continue
            
        if path.suffix in include_extensions:
            try:
                result = md.convert(str(path))
                outfile.write(f"\n\n--- FILE: {path} ---\n\n")
                outfile.write(result.text_content)
                print(f"Processed: {path}")
            except Exception as e:
                print(f"Skipping {path}: {e}")

print(f"\nDone! File '{output_filename}' has been created in your project folder.")