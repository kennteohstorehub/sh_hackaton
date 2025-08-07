#!/bin/bash

echo "Updating all port references to 3000..."

# Update all JavaScript files
find . -type f -name "*.js" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;
find . -type f -name "*.js" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;

# Update all EJS template files
find . -type f -name "*.ejs" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;
find . -type f -name "*.ejs" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;

# Update all Markdown files
find . -type f -name "*.md" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;
find . -type f -name "*.md" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;

# Update all JSON files
find . -type f -name "*.json" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;
find . -type f -name "*.json" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;

# Update shell scripts
find . -type f -name "*.sh" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;
find . -type f -name "*.sh" -not -path "./node_modules/*" -exec sed -i '' 's/:3000/:3000/g' {} \;

echo "✅ All port references updated to 3000"

# Show some examples of what was updated
echo ""
echo "Sample of updated references:"
grep -r "lvh.me:3000" --include="*.js" --include="*.ejs" | head -5