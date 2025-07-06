# 🚀 SupportGenius Production Deployment Guide

## Overview
This guide covers how to deploy SupportGenius to production and integrate the chat widget on your clients' websites.

## 1. Deploy to Production

### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from your project directory
cd supportgenius
vercel

# Follow the prompts to link/create project
```

### Option B: Other Platforms
Deploy to Netlify, Railway, Render, or any other platform that supports Next.js.

## 2. Configure Environment Variables

### Required Environment Variables:
```env
# Database
DATABASE_URL=your_production_database_url

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# NextAuth (if using authentication)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-domain.vercel.app

# API Base URL for widget (IMPORTANT!)
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app
```

### Setting Variables in Vercel:
```bash
# Set environment variables
vercel env add DATABASE_URL
vercel env add OPENAI_API_KEY
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add NEXT_PUBLIC_API_URL

# Redeploy with new variables
vercel --prod
```

## 3. Database Setup

### Important: Prisma + Vercel Fix
Due to Vercel's dependency caching, you may encounter Prisma Client initialization errors. This is already fixed in the codebase with:

**package.json changes:**
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

**vercel.json configuration:**
```json
{
  "buildCommand": "prisma generate && npm run build",
  "installCommand": "npm ci && prisma generate"
}
```

### Database Setup Commands:
```bash
# Push database schema to production
npx prisma db push

# Generate Prisma client (done automatically during build)
npx prisma generate
```

### Alternative: Manual Database Setup
If you prefer to set up the database manually:

```bash
# 1. Create production database (e.g., PostgreSQL on Railway, PlanetScale, etc.)
# 2. Set DATABASE_URL environment variable
# 3. Push schema
npx prisma db push

# 4. Optional: Seed with sample data
npx prisma db seed
```

## 4. Configure Agents for Production

1. **Login to your production dashboard**: `https://your-domain.vercel.app/dashboard`
2. **Create/Edit Agent**
3. **Configure Allowed Domains**:
   ```
   client-website.com
   www.client-website.com
   *.client-website.com    # For subdomains
   ```
4. **Copy Widget Key**: Copy the generated widget key for the client

## 5. Client Integration

### Standard Integration
Provide this code to your client:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Client Website</title>
</head>
<body>
    <!-- Client's website content -->
    
    <!-- SupportGenius Widget -->
    <script src="https://your-domain.vercel.app/api/widget.js?key=CLIENT_WIDGET_KEY"></script>
</body>
</html>
```

### WordPress Integration
For WordPress sites:

```php
// Add to theme's functions.php or create a plugin
function add_support_genius_widget() {
    ?>
    <script src="https://your-domain.vercel.app/api/widget.js?key=CLIENT_WIDGET_KEY"></script>
    <?php
}
add_action('wp_footer', 'add_support_genius_widget');
```

### React/Next.js Integration
For React applications:

```jsx
// components/SupportWidget.jsx
import { useEffect } from 'react';

export default function SupportWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://your-domain.vercel.app/api/widget.js?key=CLIENT_WIDGET_KEY';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (window.SupportGeniusWidget) {
        const widgets = document.querySelectorAll('.sgw-fab, .sgw-window');
        widgets.forEach(widget => widget.remove());
        delete window.SupportGeniusWidget;
      }
    };
  }, []);

  return null;
}

// In your main component
import SupportWidget from './components/SupportWidget';

export default function App() {
  return (
    <div>
      {/* Your app content */}
      <SupportWidget />
    </div>
  );
}
```

## 6. Security Configuration

### Content Security Policy
The widget automatically handles CSP headers, but if your client has strict CSP, they may need to add:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://your-domain.vercel.app;
  connect-src 'self' https://your-domain.vercel.app;
  style-src 'self' 'unsafe-inline';
">
```

### Domain Restrictions
- Always configure allowed domains for each agent
- Use wildcard domains (`*.example.com`) for subdomains
- Never leave allowed domains empty in production

## 7. Monitoring & Analytics

### Health Check Endpoint
```bash
# Check if your deployment is healthy
curl https://your-domain.vercel.app/api/health
```

### Widget Analytics
Monitor widget usage in your dashboard:
- Chat volume per agent
- Response times
- Common questions
- Domain usage

## 8. Scaling Considerations

### Database
- Use a production-grade database (PostgreSQL recommended)
- Set up connection pooling
- Monitor query performance

### Rate Limiting
The widget includes built-in rate limiting, but consider:
- CDN caching for widget.js file
- Database query optimization
- OpenAI API rate limits

### Performance
- Widget lazy-loads to minimize impact
- CSS is injected only when needed
- Session storage prevents redundant API calls

## 9. Troubleshooting

### Common Issues:

1. **405 Method Not Allowed**
   - Check `NEXT_PUBLIC_API_URL` environment variable
   - Verify domain is in allowed domains list

2. **Widget not loading**
   - Check browser console for errors
   - Verify widget key is correct
   - Check CSP headers

3. **CORS issues**
   - Add client domain to allowed domains
   - Check referer header validation

4. **Prisma Client Initialization Error**
   ```
   PrismaClientInitializationError: Prisma has detected that this project was built on Vercel
   ```
   **Solution:**
   - Ensure `vercel.json` and updated `package.json` scripts are deployed
   - Clear Vercel build cache: `vercel --force`
   - Check that `DATABASE_URL` environment variable is set
   - Manually run: `npx prisma generate && npx prisma db push`

5. **Database Connection Issues**
   - Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
   - Check database server is accessible from Vercel
   - Test connection with health endpoint: `/api/health`

### Debug Mode:
Add `?debug=1` to widget URL for verbose logging:
```html
<script src="https://your-domain.vercel.app/api/widget.js?key=KEY&debug=1"></script>
```

## 10. Client Onboarding Checklist

- [ ] Agent created and configured
- [ ] Client domain added to allowed domains
- [ ] Widget key provided to client
- [ ] Integration code provided
- [ ] Test widget on client's staging site
- [ ] Verify production deployment
- [ ] Monitor initial usage

## Support

For issues or questions:
1. Check the dashboard logs
2. Review browser console errors
3. Verify environment variables
4. Test with a simple HTML file first 