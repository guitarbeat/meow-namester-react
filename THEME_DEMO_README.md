# Welcome Screen Theme Demo

This demo showcases the welcome screen component in both light and dark modes, demonstrating the theme switching functionality.

## 🎨 What You'll See

The welcome screen features:
- **Cat Image Gallery**: Rotating images with navigation controls
- **Interactive Name Display**: Clickable name components with statistics tooltips
- **Animated Card Layout**: Rotated card with smooth transitions
- **Theme-Aware Styling**: Colors and backgrounds that adapt to the selected theme
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🚀 How to Run the Demo

### Option 1: Quick Start
```bash
./demo-theme.js
```

### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open demo files in your browser
open welcome-theme-comparison.html
open welcome-screen-demo.html
```

## 📱 Demo Files

### 1. Side-by-Side Comparison (`welcome-theme-comparison.html`)
- Shows both light and dark modes simultaneously
- Perfect for comparing theme differences
- No JavaScript required - pure CSS demonstration

### 2. Interactive Demo (`welcome-screen-demo.html`)
- Interactive theme switching
- Simulates the actual React component
- Includes theme toggle buttons

### 3. React Component Demo (`src/demo/ThemeDemo.jsx`)
- Full React component with theme switching
- Uses the actual `useTheme` hook
- Accessible via the development server

## 🌓 Theme Differences

### Light Mode
- **Background**: Light blue-gray (`#334155`)
- **Cards**: Medium gray (`#475569`)
- **Text**: Light colors for contrast
- **Accent**: Warm gold (`#e8bf76`)
- **Feel**: Clean, professional, inviting

### Dark Mode
- **Background**: Very dark blue (`#020617`)
- **Cards**: Dark slate (`#0f172a`)
- **Text**: Light colors for contrast
- **Accent**: Same warm gold (`#e8bf76`)
- **Feel**: Modern, sleek, sophisticated

## 🎯 Key Features Demonstrated

1. **Theme Toggle**: Switch between light and dark modes
2. **Smooth Transitions**: All color changes are animated
3. **Consistent Branding**: Accent colors remain consistent
4. **Accessibility**: High contrast ratios for readability
5. **Responsive**: Adapts to different screen sizes

## 🛠️ Technical Implementation

The theme system uses:
- CSS custom properties (variables)
- `useTheme` React hook for state management
- `localStorage` for persistence
- Smooth CSS transitions
- Mobile-first responsive design

## 📱 Mobile Experience

The welcome screen is optimized for mobile devices with:
- Touch-friendly button sizes (44px minimum)
- Responsive typography
- Optimized animations for performance
- Proper viewport handling

## 🎨 Customization

You can customize the themes by modifying:
- `src/shared/styles/theme.css` - Theme variables
- `src/core/hooks/useTheme.js` - Theme logic
- `src/shared/components/WelcomeScreen/WelcomeScreen.module.css` - Component styles

## 🔧 Development

To contribute to the theme system:
1. Modify theme variables in `theme.css`
2. Update component styles to use CSS variables
3. Test in both light and dark modes
4. Ensure accessibility compliance
5. Test on mobile devices

## 📊 Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 🎉 Enjoy the Demo!

Use the theme toggle buttons to see how the welcome screen adapts to different themes. Notice how the colors, shadows, and overall feel change while maintaining the same functionality and layout.