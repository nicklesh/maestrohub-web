# Maestro Habitat Mobile App UI Reference

## Overview
This document captures all the UI elements, icons, and layouts from the mobile app preview at:
https://maestro-web-1.preview.emergentagent.com

Test credentials:
- Email: parent1@test.com
- Password: password123
- Role: parent

---

## 1. LOGIN PAGE
- **MH Logo** (cursive "mh" in blue oval with orange accent)
- **"Maestro Habitat"** title in blue
- **Tagline:** "Where potential resolves into mastery!" (italic)
- **"Welcome Back"** heading
- **"Sign in to your account"** subtext
- **Email input** with envelope icon
- **Password input** with lock icon + eye toggle
- **"Sign In"** blue button (full width, rounded)
- **"Forgot Password?"** link
- **"Don't have an account? Sign Up"** link

---

## 2. HEADER (All Authenticated Pages)
**Left Side:**
- Blue circle avatar with user's first letter (e.g., "J")
- Name below avatar (e.g., "John")
- Role below name (e.g., "parent")

**Center:**
- MH Logo (smaller version)

**Right Side (icons, left to right):**
- Bell icon (notifications) - with red badge if unread
- Envelope/Mail icon (contact)
- Door/Exit icon (logout)

---

## 3. BOTTOM NAVIGATION (Footer)
5 items with icons and labels:

| Position | Icon | Label | Icon Type |
|----------|------|-------|-----------|
| 1 | House | Home | Outline/filled |
| 2 | Magnifying glass | Search | Outline |
| 3 | Calendar | Bookings | Outline |
| 4 | Two people | My Kids | Outline |
| 5 | Person in circle | Account | Outline |

- Selected item: filled icon + label in primary blue
- Unselected: outline icon + gray label

---

## 4. HOME PAGE
**Welcome section:**
- "Welcome back, [Name]! 👋"
- "What would you like to do today?"

**4 Action Cards (2x2 grid):**

| Card | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | Magnifying glass in circle (blue bg) | Search a Coach | Browse and find the perfect coach for... |
| 2 | Calendar grid in circle (blue bg) | Your Bookings | View and manage your scheduled sessions |
| 3 | Two people in circle (blue bg) | My Kids Sessions | Manage your children's profiles... |
| 4 | Person in circle (blue bg) | View Your Account | Manage your profile, settings, and... |

Each card has: icon, title, description, arrow (→)

**Pro Tip section (at bottom):**
- Lightbulb icon
- "Pro Tip" title
- Helpful message

---

## 5. SEARCH PAGE - Category Browse

**Search box:**
- Magnifying glass icon
- Placeholder: "Search coaches, subjects..."
- Rounded, light background

**"Browse Categories" section title**

**Category cards (2-column grid):**

| Category | Icon | Subject Count |
|----------|------|---------------|
| Relationships & Family | Heart | X subjects |
| Coaching & Personal Growth | Seedling/sprout | X subjects |
| Health, Mindfulness & Wellbeing | Heart with pulse | X subjects |
| Culture, Inclusion & Experiences | Globe | X subjects |
| Performance & Creative Arts | Microphone | X subjects |
| Activities & Hobbies | Puzzle piece | X subjects |
| Fitness & Nutrition | Dumbbell | X subjects |
| Academics | Graduation cap | X subjects |
| Finance, Legal & Negotiation | Briefcase/scales | X subjects |
| Business, Communication & Leadership | Chart/presentation | X subjects |

Card layout:
- Icon in blue circle (left)
- Category name (bold)
- "X subjects" below name (gray)

---

## 6. SEARCH PAGE - Category Selected (Coach List)

**Top elements:**
- Selected category pill with X to clear (e.g., "Academics ✕")
- CATEGORY dropdown
- SUBJECT dropdown (All Subjects)
- Toggle: "Show coaches from all countries" (with switch)

**Coach Cards:**
Each card contains:
- **Flag + Country code** (e.g., 🇺🇸 US, 🇬🇧 GB)
- **Avatar** (circle with initial, colored background)
- **Name + Price/hr** (e.g., "Sarah Johnson · $75/hr")
- **Rating** (star + number) + **"New" badge** (if applicable)
- **Bio excerpt** (2-3 lines, gray)
- **Category tag** (folder icon + category name)
- **Subject count** (book icon + "X Subject(s)")
- **Modality** (monitor icon + "Online" / "Hybrid" / "In-Person")

For cross-market coaches:
- Original price in parentheses: "$60/hr ($48)"

---

## 7. COACH DETAIL PAGE

**Header:**
- Back arrow (left)
- Empty (no title)

**Profile section:**
- Large avatar (circle, with initial)
- Name + Country flag badge (e.g., "Sarah Johnson 🇺🇸 US")
- Rating: "0.0 (0 Reviews)"
- Modality badge: "Online" (or Hybrid/In-Person)
- Price: "$75/hr"

**Cross-Market Info Box (if coach is from different country):**
- Light blue background
- Globe icon + Flag + "Coach from [Country]"
- "Choose a coach from your country if you prefer local sessions."

**Sections:**
1. **About** - Bio text
2. **Subjects** - Pill badges for each subject
3. **Policies**:
   - "24 hours notice required for cancellations"
   - "Full charge for no-shows without 24-hour notice"

**Date Selection (bottom):**
- "Select Date..." button/dropdown
- Calendar picker
- Available time slots

---

## 8. ACCOUNT/PROFILE PAGE

**User card (top):**
- Large avatar (blue circle with initial)
- Name (bold)
- Role below name
- Bell icon with badge (notifications count)

**Appearance section:**
- "Light Mode" / "Dark Mode" with sun/moon icon
- Toggle switch

**Account section (menu items with icons):**

| Icon | Label | Badge |
|------|-------|-------|
| Person outline | Edit Profile | - |
| Bell | Notifications | Count badge |
| Diamond (purple) | Subscription | - |
| Alarm clock | Reminders | - |
| Star | Reviews | - |
| Credit card | Billing | - |
| Bar chart | Reports | - |
| Document | Tax Reports | - |
| Gift | Referrals | - |
| Person+ | Invite Parents | - |
| Person+ | Invite Providers | - |
| Graduation cap | Become a Coach | (consumer only) |

**Support section:**

| Icon | Label |
|------|-------|
| Chat bubble | Contact Us |
| Question mark circle | Help Center |
| Language/translate | Language |

**Logout button:**
- Red background (light)
- Door/exit icon
- "Logout" text in red

**Version info at bottom**

---

## 9. MY KIDS PAGE

**Header:**
- Same as other pages
- "My Kids" title
- "Add Child" button (blue pill with + icon)

**Child cards:**
- Avatar (circle with initial)
- Name
- Age
- Edit (pencil) and Delete (trash) icons
- "View Schedule & Payments" link with calendar icon

---

## 10. ADD CHILD BOTTOM SHEET

**Form fields:**
- Name (required) - text input
- Age - number input
- Grade - dropdown

**Notification Contact (Optional) section:**
- Info message about notifications
- Email input
- Phone Number input
- Checkbox: "Send session reminders to this contact"
- Checkbox: "Auto-send quarterly schedules"

**"Add Child" blue button**

---

## 11. BOOKINGS PAGE

**Tabs (horizontal pills):**
- Upcoming (selected = filled blue)
- Past (outline)
- Rescheduled (outline)
- Cancelled (outline)

**Empty state:**
- Calendar icon (large, gray)
- "No upcoming bookings"

**Booking card (when bookings exist):**
- Coach avatar + name
- Subject/topic
- Date & time
- Duration
- Status badge
- Action buttons (Cancel, Reschedule, Join)

---

## 12. LANGUAGE PAGE

**Current Language card:**
- Translation icon
- "Current Language: English (US)"

**Language sections:**

**AMERICAS & EUROPE:**
- English (US) ✓ (checkmark if selected)
- Español (España)
- Français (France)
- Deutsch (Deutschland)

**INDIAN LANGUAGES:**
- हिन्दी (भारत) - Hindi
- বাংলা (ভারত) - Bengali
- తెలుగు - Telugu

---

## 13. OTHER PAGES

### Forgot Password
- Back arrow
- MH Logo + title + tagline
- Lock icon in blue circle
- "Forgot Password" title
- Description text
- Email input
- "Send Reset Link" button
- "Remember your password? Sign In" link

### Sign Up / Register
- MH Logo + title + tagline
- "Create Account" + "Join our tutoring community"
- Role selector: "I'm a Parent" | "I'm a Coach" (toggles)
- Full Name input
- Email input
- Password input (with eye toggle)
- Confirm Password input
- "Create Account" button
- "Already have an account? Sign In" link

### Edit Profile
- Back arrow + "Edit Profile" title
- Profile Information section:
  - Name input
  - Email input (disabled)
  - Phone Number input
  - "Save Changes" button
- Change Password section:
  - Current Password
  - New Password
  - Confirm New Password

### Notifications
- List of notification cards
- Each card: icon, title, time (e.g., "1d ago"), message
- Unread indicator (blue dot)

### Help Center / FAQ
- Accordion sections with icons:
  - Getting Started (rocket icon)
  - Booking & Sessions (calendar icon)
  - Payments & Billing (credit card icon)
- Each section expands to show Q&A items

### Contact Us (Bottom Sheet)
- X close button
- Mail icon + "Contact Us" title
- Subject input
- Message textarea
- "Send Message" button

### Billing
- Pending Balance card ($0.00)
- Payment Methods section
  - Stripe method with "Default" badge
  - "+ Add Payment Method" button
- Auto-Pay toggle
- Security info message

### Referrals
- Your Rewards card (gift icon)
- Your Referral Code with copy/share buttons
- "Have a Referral Code?" input + Apply button
- Empty state: "No referrals yet"

---

## Icon Library (Lucide React equivalents)

| Mobile Icon | Lucide React |
|-------------|--------------|
| House | Home |
| Magnifying glass | Search |
| Calendar | Calendar |
| Two people | Users |
| Person circle | User, UserCircle |
| Bell | Bell |
| Envelope | Mail |
| Door/Exit | LogOut |
| Heart | Heart |
| Seedling | Sprout |
| Heart pulse | HeartPulse |
| Globe | Globe |
| Microphone | Mic |
| Puzzle | Puzzle |
| Dumbbell | Dumbbell |
| Graduation cap | GraduationCap |
| Star | Star |
| Credit card | CreditCard |
| Bar chart | BarChart3 |
| Document | FileText |
| Gift | Gift |
| Person+ | UserPlus |
| Chat bubble | MessageCircle |
| Question mark | HelpCircle |
| Language | Languages |
| Alarm clock | AlarmClock |
| Diamond | Diamond |
| Pencil | Pencil |
| Trash | Trash2 |
| Lightbulb | Lightbulb |
| Arrow right | ArrowRight |
| Chevron right | ChevronRight |
| Plus | Plus |
| X | X |
| Eye | Eye |
| Lock | Lock |
| Folder | Folder |
| Book | BookOpen |
| Monitor | Monitor |
| Rocket | Rocket |

---

## Color Scheme

- **Primary Blue:** #3B82F6 (for buttons, icons, links)
- **Primary Light:** #EBF5FF (light blue backgrounds)
- **Text:** #1F2937 (dark gray)
- **Text Muted:** #6B7280 (medium gray)
- **Background:** #FFFFFF (white)
- **Surface:** #F9FAFB (off-white)
- **Border:** #E5E7EB (light gray)
- **Success:** #10B981 (green)
- **Warning:** #F59E0B (orange/yellow)
- **Error:** #EF4444 (red)
- **Error Light:** #FEE2E2 (light red for logout button)
