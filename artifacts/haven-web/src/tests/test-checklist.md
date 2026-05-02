# Test Execution Checklist

## Pre-Test Setup

- [ ] Open browser developer tools (F12)
- [ ] Clear browser cache and local storage
- [ ] Ensure you're on the latest preview build
- [ ] Have access to Lovable Cloud backend dashboard
- [ ] Review test credentials

## Test Credentials

### Provider Account
- Email: `provider-test@example.com`
- Password: `TestPass123!`

### Seeker Account
- Email: `seeker-test@example.com`
- Password: `TestPass123!`

---

## Workflow 1: Provider Setup Flow

### Step 1: Provider Signup
- [ ] Navigate to `/auth`
- [ ] Click "Sign Up" tab
- [ ] Enter email: `provider-test@example.com`
- [ ] Enter password: `TestPass123!`
- [ ] Click "Sign Up" button
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to `/auth/role`
- [ ] **Verify**: Role selection page displays correctly

### Step 2: Role Selection
- [ ] Click "Provider" card
- [ ] **Verify**: Loading spinner appears
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to `/dashboard`
- [ ] **Verify**: Provider dashboard displays
- [ ] **Verify**: "No engagements yet" message shown
- [ ] **Verify**: "Setup Program" button visible

### Step 3: Provider Configuration
- [ ] Click "Setup Program" button
- [ ] **Verify**: Navigated to `/provider/setup`
- [ ] Click "Career Transition Coach" template (or any available template)
- [ ] **Verify**: Form populates with template data:
  - [ ] Title field filled
  - [ ] Methodology field filled
  - [ ] Stages displayed
  - [ ] Labels displayed
  - [ ] Summary template displayed
- [ ] Click "Save Configuration"
- [ ] **Verify**: Success toast appears
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to dashboard

### Step 4: AI Agent Setup
- [ ] Click "Setup AI Agent" button
- [ ] **Verify**: Navigated to `/provider/agent-setup`
- [ ] **Verify**: "Guiding Principles" is auto-populated
- [ ] Fill in fields:
  - [ ] Core Identity: "I am an AI coaching assistant specialized in career transitions"
  - [ ] Tone: "Supportive and professional"
  - [ ] Voice: "Clear, encouraging, and action-oriented"
  - [ ] Rules: "Always validate user progress\nAsk clarifying questions"
  - [ ] Boundaries: "Do not provide medical advice\nDo not make career decisions for users"
- [ ] **Verify**: AI Model dropdown shows options
- [ ] Select "Gemini 2.5 Flash" (should be default)
- [ ] Click "Save Configuration"
- [ ] **Verify**: Success toast appears
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to dashboard

### Step 5: Verify Provider Dashboard
- [ ] **Verify**: Dashboard shows:
  - [ ] Provider name/title
  - [ ] "Edit Program" button (previously "Setup Program")
  - [ ] "Edit AI Agent" button (previously "Setup AI Agent")
  - [ ] "Active Engagements" section (empty)

### Database Verification (Workflow 1)
Open Lovable Cloud backend and run these queries:

```sql
-- Check provider config
SELECT * FROM provider_configs 
WHERE provider_id = (
  SELECT user_id FROM user_roles 
  WHERE role = 'provider' 
  AND user_id = (SELECT id FROM auth.users WHERE email = 'provider-test@example.com')
);
```
- [ ] **Verify**: 1 row returned
- [ ] **Verify**: `methodology` is populated
- [ ] **Verify**: `stages` array is populated
- [ ] **Verify**: `labels` array is populated

```sql
-- Check agent config
SELECT * FROM provider_agent_configs 
WHERE provider_id = (
  SELECT user_id FROM user_roles 
  WHERE role = 'provider' 
  AND user_id = (SELECT id FROM auth.users WHERE email = 'provider-test@example.com')
);
```
- [ ] **Verify**: 1 row returned
- [ ] **Verify**: `core_identity` matches input
- [ ] **Verify**: `guiding_principles` is auto-populated
- [ ] **Verify**: `tone`, `voice`, `rules`, `boundaries` match inputs
- [ ] **Verify**: `selected_model` is set to 'google/gemini-2.5-flash'

---

## Workflow 2: Seeker Journey Flow

### Pre-Step: Logout
- [ ] Click profile/logout button
- [ ] **Verify**: Logged out and redirected to landing page

### Step 1: Seeker Signup
- [ ] Navigate to `/auth`
- [ ] Click "Sign Up" tab
- [ ] Enter email: `seeker-test@example.com`
- [ ] Enter password: `TestPass123!`
- [ ] Click "Sign Up" button
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to `/auth/role`

### Step 2: Seeker Role Selection
- [ ] Click "Seeker" card
- [ ] **Verify**: Loading spinner appears
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to `/onboarding`

### Step 3: Onboarding - Agent Selection
- [ ] **Verify**: Onboarding page displays
- [ ] **Verify**: At least one provider card shown (from Workflow 1)
- [ ] **Verify**: Provider card shows:
  - [ ] Provider name/title
  - [ ] Program title
  - [ ] Methodology description
  - [ ] "Connect" button
- [ ] Click "Connect" on provider card
- [ ] **Verify**: Loading state appears
- [ ] **Verify**: Success toast appears
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to `/dashboard`

### Step 4: Verify Seeker Dashboard
- [ ] **Verify**: Dashboard shows:
  - [ ] "Your Journey" header
  - [ ] Active engagement card
  - [ ] Provider name
  - [ ] Program title
  - [ ] "Start Session" button
  - [ ] Stage: "Not yet determined" or similar

### Step 5: Start AI Conversation
- [ ] Click "Start Session" button
- [ ] **Verify**: Navigated to `/chat/[sessionId]`
- [ ] **Verify**: Chat interface displays:
  - [ ] Welcome message from AI
  - [ ] Message input field
  - [ ] Send button
  - [ ] "End Session" button

### Step 6: AI Conversation Test
- [ ] Type message: "Hi! I'm looking to transition from software engineering to product management."
- [ ] Click Send
- [ ] **Verify**: Message appears in chat
- [ ] **Verify**: AI responds (may take a few seconds)
- [ ] **Verify**: AI response is personalized
- [ ] **Verify**: Response reflects provider's tone and voice
- [ ] **Verify**: No console errors

- [ ] Type message: "I have 5 years of experience as a developer, but I want to focus more on strategy and user needs."
- [ ] Click Send
- [ ] **Verify**: Message appears
- [ ] **Verify**: AI responds appropriately
- [ ] **Verify**: AI asks clarifying questions

- [ ] Type message: "I'm most interested in learning about user research and roadmap planning."
- [ ] Click Send
- [ ] **Verify**: Message appears
- [ ] **Verify**: AI provides relevant guidance

- [ ] Type message: "What are the first steps I should take?"
- [ ] Click Send
- [ ] **Verify**: Message appears
- [ ] **Verify**: AI provides actionable next steps
- [ ] **Verify**: AI references stages from provider config

### Step 7: End Session
- [ ] Click "End Session" button
- [ ] **Verify**: Confirmation dialog appears
- [ ] Click "Confirm" or "Yes"
- [ ] **Verify**: Loading state appears
- [ ] **Verify**: Navigated to `/session/[sessionId]/summary`

### Step 8: Verify Session Summary
- [ ] **Verify**: Summary page displays:
  - [ ] Session summary text (AI-generated)
  - [ ] Key insights section (array of insights)
  - [ ] Assigned stage (from provider's stages)
  - [ ] Trajectory status (e.g., "on_track", "needs_support")
  - [ ] Next action recommendation
- [ ] **Verify**: All fields are populated (not empty)
- [ ] **Verify**: Stage matches one from provider config
- [ ] **Verify**: Trajectory status is one of: on_track, ahead, needs_support, at_risk

### Database Verification (Workflow 2)
Open Lovable Cloud backend and run these queries:

```sql
-- Check engagement was created
SELECT * FROM engagements 
WHERE seeker_id = (
  SELECT id FROM seekers 
  WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'seeker-test@example.com')
);
```
- [ ] **Verify**: 1 engagement returned
- [ ] **Verify**: `status` is 'active'
- [ ] **Verify**: `provider_id` matches provider from Workflow 1
- [ ] **Verify**: `seeker_id` is populated

```sql
-- Check session was created
SELECT * FROM sessions 
WHERE engagement_id IN (
  SELECT id FROM engagements 
  WHERE seeker_id = (
    SELECT id FROM seekers 
    WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'seeker-test@example.com')
  )
);
```
- [ ] **Verify**: 1 session returned
- [ ] **Verify**: `status` is 'completed'
- [ ] **Verify**: `initial_stage` is populated
- [ ] **Verify**: `started_at` and `ended_at` are set

```sql
-- Check messages were saved
SELECT COUNT(*) as message_count FROM messages 
WHERE session_id IN (
  SELECT id FROM sessions 
  WHERE engagement_id IN (
    SELECT id FROM engagements 
    WHERE seeker_id = (
      SELECT id FROM seekers 
      WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'seeker-test@example.com')
    )
  )
);
```
- [ ] **Verify**: At least 8 messages (4 seeker + 4 agent minimum)

```sql
-- Check summary was created
SELECT * FROM summaries 
WHERE session_id IN (
  SELECT id FROM sessions 
  WHERE engagement_id IN (
    SELECT id FROM engagements 
    WHERE seeker_id = (
      SELECT id FROM seekers 
      WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'seeker-test@example.com')
    )
  )
);
```
- [ ] **Verify**: 1 summary returned
- [ ] **Verify**: `session_summary` is populated
- [ ] **Verify**: `key_insights` array has items
- [ ] **Verify**: `assigned_stage` matches provider's stages
- [ ] **Verify**: `trajectory_status` is valid
- [ ] **Verify**: `next_action` is populated

---

## Workflow 3: Provider Monitoring Flow

### Pre-Step: Logout and Login as Provider
- [ ] Click profile/logout button
- [ ] Navigate to `/auth`
- [ ] Click "Sign In" tab
- [ ] Enter email: `provider-test@example.com`
- [ ] Enter password: `TestPass123!`
- [ ] Click "Sign In"
- [ ] **Verify**: Redirected to `/dashboard`

### Step 1: View Active Engagements
- [ ] **Verify**: Provider dashboard displays
- [ ] **Verify**: "Active Engagements" section shows:
  - [ ] At least 1 engagement card
  - [ ] Seeker identifier or reference
  - [ ] Program title
  - [ ] Current stage (from AI assignment)
  - [ ] Status: "Active"
  - [ ] "View Details" button

### Step 2: Review Engagement Details
- [ ] Click "View Details" on engagement card
- [ ] **Verify**: Navigated to `/provider/engagement/[engagementId]`
- [ ] **Verify**: Page displays:
  - [ ] Seeker information section
  - [ ] Current stage indicator
  - [ ] Trajectory status
  - [ ] Session history section
  - [ ] At least 1 completed session listed
- [ ] **Verify**: Session card shows:
  - [ ] Session date/time
  - [ ] Status: "Completed"
  - [ ] "View Summary" button

### Step 3: Review Session Summary
- [ ] Click "View Summary" on completed session
- [ ] **Verify**: Navigated to `/session/[sessionId]/summary`
- [ ] **Verify**: Summary displays:
  - [ ] Session summary text
  - [ ] Key insights (matching seeker's conversation)
  - [ ] Assigned stage (from provider's stages)
  - [ ] Trajectory status
  - [ ] Next action recommendation
- [ ] **Verify**: Assigned stage is one of provider's configured stages
- [ ] **Verify**: Trajectory status is meaningful (e.g., "on_track" based on conversation)

### Step 4: Verify Trajectory Classification
- [ ] **Verify**: Trajectory status is one of:
  - [ ] `on_track`: Progress aligns with expectations
  - [ ] `ahead`: Exceeding expectations
  - [ ] `needs_support`: Falling behind
  - [ ] `at_risk`: Significant intervention needed
- [ ] **Verify**: Classification makes sense based on seeker's conversation
- [ ] **Verify**: Visual indicator matches status (color, icon)

### Step 5: Verify Stage Assignment
- [ ] **Verify**: Assigned stage matches one from provider's configuration
- [ ] **Verify**: Stage assignment is logical based on conversation content
- [ ] Example: If seeker discussed "exploring career paths", stage might be "Exploration"

---

## Final Verification Checklist

### Overall System Health
- [ ] No console errors throughout any workflow
- [ ] No network request failures (check Network tab)
- [ ] All page transitions smooth and correct
- [ ] All loading states display properly
- [ ] All success/error toasts appear appropriately
- [ ] All forms validate properly

### Authentication & Authorization
- [ ] Users can sign up successfully
- [ ] Users can sign in successfully
- [ ] Users can sign out successfully
- [ ] Role selection works correctly
- [ ] No duplicate roles in database
- [ ] Protected routes require authentication
- [ ] Role-based access control works

### Provider Features
- [ ] Provider can configure program from template
- [ ] Provider can setup AI agent
- [ ] Provider can edit configurations
- [ ] Provider can view active engagements
- [ ] Provider can review seeker progress
- [ ] Provider can access session summaries

### Seeker Features
- [ ] Seeker can complete onboarding
- [ ] Seeker can select provider/agent
- [ ] Seeker can start chat sessions
- [ ] Seeker can send messages
- [ ] Seeker can receive AI responses
- [ ] Seeker can end sessions
- [ ] Seeker can view summaries

### AI Agent Features
- [ ] Agent uses provider's configuration
- [ ] Agent responds with correct tone and voice
- [ ] Agent follows guiding principles
- [ ] Agent respects boundaries
- [ ] Agent references stages and labels
- [ ] Agent generates accurate summaries
- [ ] Selected model (Gemini 2.5 Flash) is used
- [ ] No API key errors (uses Lovable AI)

### Data Persistence
- [ ] User profiles created correctly
- [ ] User roles stored correctly
- [ ] Provider configs saved
- [ ] Agent configs saved
- [ ] Engagements created
- [ ] Sessions tracked
- [ ] Messages persisted
- [ ] Summaries generated and saved
- [ ] Progress indicators logged

### Edge Cases Handled
- [ ] Existing user trying to select role again
- [ ] User without role trying to access protected routes
- [ ] Empty states display properly
- [ ] Loading states don't hang
- [ ] Error states show helpful messages
- [ ] Network failures handled gracefully

---

## Issues Found

### Critical Issues (Blocks Testing)
- Issue:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

### Major Issues (Degrades Experience)
- Issue:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

### Minor Issues (Cosmetic/Polish)
- Issue:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

---

## Test Summary

**Test Date**: _______________
**Tester**: _______________
**Build Version**: _______________

**Workflow 1 Status**: ☐ Pass ☐ Fail ☐ Partial
**Workflow 2 Status**: ☐ Pass ☐ Fail ☐ Partial
**Workflow 3 Status**: ☐ Pass ☐ Fail ☐ Partial

**Overall Result**: ☐ Pass ☐ Fail ☐ Needs Work

**Notes**:
