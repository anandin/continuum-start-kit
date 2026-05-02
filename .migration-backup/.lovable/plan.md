

# Haven Rebrand Implementation Plan

## Brand Identity

**Name:** Haven
**Tagline Options:**
- "Your safe space for growth"
- "Expert-guided AI companions"
- "Where expert wisdom meets daily support"

**Core Message:** AI companions coached by therapists and experts, creating a safe haven for your growth journey.

---

## Files to Update

### 1. index.html
Update meta tags and title:
- Title: "Haven - Your Expert-Guided AI Companion"
- Description: "AI companions coached by therapists and experts, walking alongside you on your growth journey."
- OG tags with Haven branding

### 2. src/pages/Landing.tsx (Major Content Rewrite)

**For Individuals - Hero Section:**
- Headline: "Your Expert's Wisdom, Always With You"
- Subheadline: "Haven pairs you with an AI companion coached by world-class therapists and coaches—here for you 24/7, between sessions and beyond."
- CTA: "Find Your Haven"

**For Experts - Hero Section:**
- Headline: "Extend Your Care. Amplify Your Impact."
- Subheadline: "Train an AI companion with your methodology. It walks alongside your clients daily, reinforcing your guidance when you can't be there."
- CTA: "Create Your Haven"

**Feature Cards - Individuals:**
| Current | New |
|---------|-----|
| Personalized Guidance | Always By Your Side |
| Expert Methodologies | Expert-Coached Wisdom |
| Persistent & Private | Your Journey, Remembered |

**Feature Cards - Experts:**
| Current | New |
|---------|-----|
| Extend Your Reach | Care Between Sessions |
| Deeper Client Insights | See Their Journey Clearly |
| Monetize Your IP | Scale Your Methodology |

**Footer:** Update copyright and branding

### 3. src/pages/Auth.tsx
- Update logo text from "Bloom" to "Haven"
- Update welcome message

### 4. src/pages/Dashboard.tsx
- Update header logo from "Bloom" to "Haven"
- Update role dashboard subtitle styling

### 5. src/pages/RolePicker.tsx
- Update card description from "use Bloom" to "use Haven"

### 6. src/pages/Health.tsx
- Update "Bloom services" to "Haven services"
- Update heading gradient text

### 7. src/tests/manual-test-runner.tsx
- Update application description reference

---

## Messaging Guidelines

**Replace all instances of:**
- "Bloom" → "Haven"
- "AI partner/agent cloned from" → "AI companion coached by"
- "Clone" terminology → "Companion" terminology

**Key phrases to use:**
- "Expert-coached AI companion"
- "Walking alongside you"
- "Your safe space for growth"
- "Daily support guided by your expert"

---

## Visual Consistency

The current purple gradient works well with Haven's nurturing theme. No color changes needed unless you prefer a warmer palette later.

---

## Summary

| File | Type of Change |
|------|----------------|
| `index.html` | Meta tags, title, OG data |
| `src/pages/Landing.tsx` | Full content rewrite |
| `src/pages/Auth.tsx` | Logo text |
| `src/pages/Dashboard.tsx` | Logo text |
| `src/pages/RolePicker.tsx` | Description text |
| `src/pages/Health.tsx` | Service name |
| `src/tests/manual-test-runner.tsx` | Description text |

**Estimated changes:** ~7 files, text/content updates only, no structural changes

