# End-to-End Test Workflows

This document outlines the comprehensive test workflows for the Bloom platform.

## Workflow 1: Provider Signup, Configuration, and Deployment

### Objective
Test the complete provider journey from signup to AI agent deployment.

### Test Steps

1. **Provider Signup**
   - Navigate to `/auth`
   - Click "Sign Up" tab
   - Enter test credentials:
     - Email: `provider-test@example.com`
     - Password: `TestPass123!`
   - Click "Sign Up"
   - Verify redirect to `/auth/role`

2. **Role Selection**
   - On role picker page, click "Provider" card
   - Verify loading state appears
   - Verify redirect to `/dashboard`
   - Verify provider dashboard displays with "No engagements yet" message

3. **Provider Configuration (from Template)**
   - Click "Setup Program" button
   - Verify navigation to `/provider/setup`
   - Click on "Career Transition Coach" template (or any template)
   - Verify form is populated with:
     - Title
     - Methodology
     - Stages (array of stage names)
     - Labels (array of label objects)
     - Summary template (array of template sections)
     - Tagging rules (array of rules)
     - Trajectory rules (array of rules)
   - Click "Save Configuration"
   - Verify success toast appears
   - Verify redirect back to dashboard

4. **AI Agent Setup**
   - Click "Setup AI Agent" button
   - Verify navigation to `/provider/agent-setup`
   - Verify "Guiding Principles" is auto-populated with:
     - Methodology
     - Stages
     - Labels from provider config
   - Edit fields:
     - Core Identity: "I am an AI coaching assistant specialized in career transitions"
     - Tone: "Supportive and professional"
     - Voice: "Clear, encouraging, and action-oriented"
     - Rules: "Always validate user progress, Ask clarifying questions"
     - Boundaries: "Do not provide medical advice, Do not make career decisions for users"
   - Select AI Model: Choose "Gemini 2.5 Flash" (default)
   - Click "Save Configuration"
   - Verify success toast appears
   - Verify redirect back to dashboard

5. **Verification**
   - Verify provider dashboard shows:
     - Provider name
     - Setup buttons are now "Edit Program" and "Edit AI Agent"
     - "Active Engagements" section (empty initially)

### Expected Database State After Workflow 1

```sql
-- Check provider config
SELECT * FROM provider_configs WHERE provider_id = (
  SELECT user_id FROM user_roles WHERE role = 'provider'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'provider-test@example.com')
);

-- Check agent config
SELECT * FROM provider_agent_configs WHERE provider_id = (
  SELECT user_id FROM user_roles WHERE role = 'provider'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'provider-test@example.com')
);
```

Expected results:
- 1 row in `provider_configs` with filled methodology, stages, labels, etc.
- 1 row in `provider_agent_configs` with core_identity, guiding_principles, tone, voice, rules, boundaries, selected_model

---

## Workflow 2: Seeker Signup, Onboarding, and AI Conversation

### Objective
Test the complete seeker journey from signup through AI conversation and automated scoring.

### Test Steps

1. **Seeker Signup**
   - Log out from provider account (if logged in)
   - Navigate to `/auth`
   - Click "Sign Up" tab
   - Enter test credentials:
     - Email: `seeker-test@example.com`
     - Password: `TestPass123!`
   - Click "Sign Up"
   - Verify redirect to `/auth/role`

2. **Role Selection**
   - On role picker page, click "Seeker" card
   - Verify loading state appears
   - Verify redirect to `/onboarding`

3. **Onboarding - AI Agent Selection**
   - Verify onboarding page displays available providers
   - Verify provider from Workflow 1 appears in list with:
     - Provider name
     - Program title
     - Methodology description
   - Click "Connect" button on provider card
   - Verify loading state
   - Verify success toast appears
   - Verify redirect to `/dashboard`

4. **Verify Dashboard State**
   - Verify seeker dashboard displays:
     - "Your Journey" section
     - Active engagement card showing:
       - Provider name
       - Program title
       - "Start Session" button
       - Stage: "Not yet determined"

5. **Start AI Conversation**
   - Click "Start Session" button
   - Verify navigation to `/chat/[sessionId]`
   - Verify chat interface displays:
     - Welcome message from AI agent
     - Input field for messages
     - Send button
   - Send test messages to simulate conversation:
     
     **Message 1:**
     ```
     Hi! I'm looking to transition from software engineering to product management.
     ```
     - Verify AI responds with personalized greeting
     - Verify response reflects provider's configuration (tone, voice)
     
     **Message 2:**
     ```
     I have 5 years of experience as a developer, but I want to focus more on strategy and user needs.
     ```
     - Verify AI asks clarifying questions
     - Verify AI acknowledges user's experience
     
     **Message 3:**
     ```
     I'm most interested in learning about user research and roadmap planning.
     ```
     - Verify AI provides relevant guidance
     - Verify AI maintains consistent tone
     
     **Message 4:**
     ```
     What are the first steps I should take?
     ```
     - Verify AI provides actionable next steps
     - Verify AI references stages from provider config

6. **End Session**
   - Click "End Session" button
   - Verify confirmation dialog appears
   - Confirm session end
   - Verify navigation to `/session/[sessionId]/summary`

7. **Verify Session Summary**
   - Verify summary page displays:
     - Session summary text
     - Key insights (array of insights)
     - Assigned stage (from provider's stages)
     - Trajectory status (e.g., "on_track", "needs_support")
     - Next action recommendation
   - Verify all fields are populated by AI analysis

8. **Verify Database Updates**
   - Check that session is marked as completed
   - Verify summary record was created
   - Verify progress indicators were logged

### Expected Database State After Workflow 2

```sql
-- Check engagement was created
SELECT * FROM engagements WHERE seeker_id = (
  SELECT id FROM seekers WHERE owner_id = (
    SELECT id FROM auth.users WHERE email = 'seeker-test@example.com'
  )
);

-- Check session was created and completed
SELECT * FROM sessions WHERE engagement_id IN (
  SELECT id FROM engagements WHERE seeker_id = (
    SELECT id FROM seekers WHERE owner_id = (
      SELECT id FROM auth.users WHERE email = 'seeker-test@example.com'
    )
  )
);

-- Check messages were saved
SELECT COUNT(*) FROM messages WHERE session_id IN (
  SELECT id FROM sessions WHERE engagement_id IN (
    SELECT id FROM engagements WHERE seeker_id = (
      SELECT id FROM seekers WHERE owner_id = (
        SELECT id FROM auth.users WHERE email = 'seeker-test@example.com'
      )
    )
  )
);

-- Check summary was created
SELECT * FROM summaries WHERE session_id IN (
  SELECT id FROM sessions WHERE engagement_id IN (
    SELECT id FROM engagements WHERE seeker_id = (
      SELECT id FROM seekers WHERE owner_id = (
        SELECT id FROM auth.users WHERE email = 'seeker-test@example.com'
      )
    )
  )
);

-- Check progress indicators
SELECT * FROM progress_indicators WHERE session_id IN (
  SELECT id FROM sessions WHERE engagement_id IN (
    SELECT id FROM engagements WHERE seeker_id = (
      SELECT id FROM seekers WHERE owner_id = (
        SELECT id FROM auth.users WHERE email = 'seeker-test@example.com'
      )
    )
  )
);
```

Expected results:
- 1 engagement with status 'active'
- 1 session with status 'completed'
- At least 8 messages (4 from seeker, 4 from agent)
- 1 summary with populated fields
- Multiple progress indicators logged during conversation

---

## Workflow 3: Provider Returns to Review Seeker Progress

### Objective
Test provider's ability to monitor and analyze seeker progress.

### Test Steps

1. **Provider Login**
   - Log out from seeker account
   - Navigate to `/auth`
   - Click "Sign In" tab
   - Enter provider credentials:
     - Email: `provider-test@example.com`
     - Password: `TestPass123!`
   - Click "Sign In"
   - Verify redirect to `/dashboard`

2. **View Active Engagements**
   - Verify provider dashboard displays:
     - "Active Engagements" section
     - One engagement card showing:
       - Seeker identifier
       - Program title
       - Current stage (assigned by AI)
       - Status: "Active"
       - "View Details" button

3. **Review Engagement Details**
   - Click "View Details" on engagement card
   - Verify navigation to `/provider/engagement/[engagementId]`
   - Verify page displays:
     - Seeker information section
     - Current stage and trajectory status
     - Session history with:
       - Session date/time
       - Duration
       - Status
       - "View Summary" button for completed sessions

4. **Review Session Summary**
   - Click "View Summary" on completed session
   - Verify navigation to `/session/[sessionId]/summary`
   - Verify summary displays all AI-generated insights:
     - Session summary
     - Key insights array
     - Assigned stage (should match provider's defined stages)
     - Trajectory status with explanation
     - Next action recommendation

5. **Verify Trajectory Classification**
   - Check that trajectory status is one of:
     - `on_track`: Progress aligns with stage expectations
     - `ahead`: Exceeding stage expectations
     - `needs_support`: Falling behind stage expectations
     - `at_risk`: Significant intervention needed
   - Verify classification matches conversation content from Workflow 2

6. **Verify Stage Assignment**
   - Check that assigned stage is from provider's configuration
   - Verify stage assignment makes sense based on seeker's conversation
   - Example: If seeker discussed "exploring new career paths", stage might be "Exploration" or similar from provider's stages

7. **Review Progress Indicators**
   - Look for visual indicators showing:
     - Progress timeline
     - Key milestones reached
     - Areas needing attention
   - Verify indicators match tagging rules and labels from provider config

### Verification Checklist

**Provider Configuration Verification:**
- [ ] Provider config correctly saved to database
- [ ] Agent config includes all required fields
- [ ] Selected AI model is stored and used

**Seeker Journey Verification:**
- [ ] Seeker can sign up and select role
- [ ] Onboarding shows available providers
- [ ] Engagement created when seeker connects
- [ ] Session starts correctly
- [ ] AI responds using provider's configuration
- [ ] Messages are saved to database
- [ ] Session can be ended
- [ ] Summary is generated automatically

**Provider Monitoring Verification:**
- [ ] Provider sees active engagements
- [ ] Engagement details show accurate information
- [ ] Session summaries are accessible
- [ ] Trajectory status is correctly assigned
- [ ] Stage assignment matches provider's stages
- [ ] Progress indicators are meaningful

**AI Agent Verification:**
- [ ] Agent uses provider's tone and voice
- [ ] Agent follows guiding principles
- [ ] Agent respects boundaries
- [ ] Agent correctly uses stages and labels
- [ ] Agent generates accurate summaries
- [ ] Selected model (Gemini 2.5 Flash) is used

### Common Issues to Check

1. **Authentication Issues**
   - User stuck on blank page → Check auth state loading
   - Can't select role → Check for duplicate roles in database
   - Redirect loops → Check useEffect dependencies

2. **Data Loading Issues**
   - "No data" states → Check RLS policies
   - Missing configurations → Check foreign key relationships
   - Empty lists → Check query filters and user_id matching

3. **AI Conversation Issues**
   - No AI response → Check edge function logs
   - Incorrect tone → Verify agent config is loaded
   - Generic responses → Check if provider config is injected into prompt
   - Wrong model used → Verify selected_model column

4. **Summary Generation Issues**
   - Missing summary → Check session-finish edge function
   - Incorrect stage assignment → Verify stages are passed to AI
   - Invalid trajectory → Check trajectory rules logic

### Database Integrity Checks

Run these queries to verify data integrity:

```sql
-- Verify no duplicate user roles
SELECT user_id, COUNT(*) as role_count 
FROM user_roles 
GROUP BY user_id 
HAVING COUNT(*) > 1;
-- Expected: No rows (should be 0 rows)

-- Verify all engagements have both provider and seeker
SELECT e.id, e.provider_id, e.seeker_id, s.owner_id
FROM engagements e
JOIN seekers s ON s.id = e.seeker_id
WHERE e.provider_id IS NULL OR e.seeker_id IS NULL;
-- Expected: No rows

-- Verify all sessions have valid engagement references
SELECT se.id, se.engagement_id
FROM sessions se
LEFT JOIN engagements e ON e.id = se.engagement_id
WHERE e.id IS NULL;
-- Expected: No rows

-- Verify all messages belong to valid sessions
SELECT m.id, m.session_id
FROM messages m
LEFT JOIN sessions s ON s.id = m.session_id
WHERE s.id IS NULL;
-- Expected: No rows

-- Verify agent configs are properly linked
SELECT pac.id, pac.provider_id, pc.id as config_id
FROM provider_agent_configs pac
LEFT JOIN provider_configs pc ON pc.provider_id = pac.provider_id
WHERE pc.id IS NULL;
-- Expected: All agent configs should have matching provider configs
```

---

## Note on Gemini API Key

**Important:** This application uses **Lovable AI** which provides access to Google Gemini and OpenAI models WITHOUT requiring API keys from users. The `LOVABLE_API_KEY` is automatically provisioned in the Supabase environment.

**No API key collection needed** unless the user specifically requests to use a different AI provider outside of Lovable AI's supported models.

Supported models via Lovable AI:
- `google/gemini-2.5-pro`
- `google/gemini-2.5-flash` (default)
- `google/gemini-2.5-flash-lite`
- `openai/gpt-5`
- `openai/gpt-5-mini`
- `openai/gpt-5-nano`

All these models are accessible through the Lovable AI gateway at:
`https://ai.gateway.lovable.dev/v1/chat/completions`
