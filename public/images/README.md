# Image Assets

This directory should contain the following image files for the chatbot and PWA:

## Required Icons:

### Notification Icons:
- **notification-icon.png** - 192x192px icon for push notifications
- **notification-badge.png** - 72x72px badge icon

### PWA Icons (for manifest.json):
- **icon-72x72.png**
- **icon-96x96.png**
- **icon-128x128.png**
- **icon-144x144.png**
- **icon-152x152.png**
- **icon-192x192.png**
- **icon-384x384.png**
- **icon-512x512.png**

### Optional Icons:
- **join-icon.png** - 96x96px for shortcut
- **status-icon.png** - 96x96px for shortcut

## Design Guidelines:

- Use StoreHub brand colors (#ff8c00 primary)
- Transparent background preferred
- Simple, recognizable design
- High contrast for visibility

## Icon Generator Tools:

- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [Real Favicon Generator](https://realfavicongenerator.net/)
- [Maskable.app](https://maskable.app/) - For maskable icons

## Example Command to Generate Icons:

```bash
# Using ImageMagick to create icons from a source image
convert source-icon.png -resize 72x72 icon-72x72.png
convert source-icon.png -resize 96x96 icon-96x96.png
# ... etc
```