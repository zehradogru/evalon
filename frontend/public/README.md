# Public Assets Directory Structure

This directory contains all static assets served directly to the browser.

## 📁 Directory Organization

```
public/
├── images/          # All image assets
│   └── logo.jpeg    # EVALON brand logo
├── videos/          # Video files
│   └── splash-logo.mp4  # Splash screen animation
├── audio/           # Audio files (future use)
└── (other static files)
```

## 🎯 Usage Guidelines

### Images (`/images`)
- **Logo**: `/images/logo.jpeg` - Main EVALON logo (200x80)
- Add product images, icons, illustrations here
- Use Next.js `<Image>` component for optimization

### Videos (`/videos`)
- **Splash**: `/videos/splash-logo.mp4` - Loading animation
- Store promotional videos, demos, tutorials here

### Audio (`/audio`)
- Notification sounds
- Background music
- Voice prompts

### Favicon
- **Location**: `app/favicon.ico` (Next.js 14 convention)
- Auto-served at `/favicon.ico`
- Size: 32x32 or 16x16

## 📌 Best Practices

1. **Naming**: Use kebab-case (e.g., `splash-logo.mp4`)
2. **Optimization**: Compress images/videos before adding
3. **Reference**: Use relative paths from root: `/images/logo.jpeg`
4. **Format**: Prefer modern formats (WebP, MP4, WebM)
