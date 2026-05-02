# Testing Guide for Bloom Platform

## Quick Start

The runtime error you saw about `useAuth must be used within an AuthProvider` should be resolved now. The duplicate role issue has been fixed with a database migration that ensures each user can only have one role.

### Test Tools Available

1. **Manual Test Runner UI** - Navigate to `/test-runner` for an interactive test interface
2. **E2E Workflows Documentation** - See `e2e-workflows.md` for detailed step-by-step instructions
3. **Test Checklist** - Use `test-checklist.md` to track your testing progress

## How to Run Tests

### Option 1: Interactive Test Runner (Recommended)

1. Navigate to `/test-runner` in your browser
2. Click "Start" on each workflow
3. Follow the instructions for each step
4. Check off items as you complete them
5. Use browser DevTools to verify:
   - Console tab: No errors
   - Network tab: All requests successful
   - Application tab: Check localStorage and IndexedDB

### Option 2: Manual Testing with Checklist

1. Open `test-checklist.md`
2. Print or have it open in a second window
3. Go through each workflow step-by-step
4. Check off each item as you complete it
5. Note any issues in the "Issues Found" section

## Before You Start Testing

### 1. Clear Your Session
```
- Open DevTools (F12)
- Go to Application tab
- Clear all Local Storage
- Clear all Session Storage
- Clear all Cookies
- Reload the page
```

### 2. Open DevTools
Keep DevTools open during testing to monitor:
- Console for errors
- Network for failed requests
- Application storage

### 3. Database Access
You can access the Lovable Cloud backend to:
- Run SQL queries
- View table data
- Check RLS policies
- Monitor edge function logs

## Test Execution Order

Execute tests in this order for best results:

### 1. Workflow 1: Provider Setup (15-20 minutes)
**Goal**: Verify provider can sign up, configure program, and setup AI agent

**Key Checkpoints**:
- ✅ Provider signup works
- ✅ Role selection persists
- ✅ Template configuration saves
- ✅ Agent config saves with selected model
- ✅ Database has correct entries

**Expected Outcome**: Provider is fully configured and ready to accept seekers

---

### 2. Workflow 2: Seeker Journey (20-25 minutes)
**Goal**: Verify seeker can sign up, choose provider, have AI conversation, and get summary

**Key Checkpoints**:
- ✅ Seeker signup works
- ✅ Role selection persists
- ✅ Onboarding shows available providers
- ✅ Engagement created on connection
- ✅ Chat session works
- ✅ AI responds using provider's config
- ✅ Session summary generated
- ✅ Trajectory and stage assigned correctly

**Expected Outcome**: Seeker has completed session with AI-generated insights

---

### 3. Workflow 3: Provider Monitoring (10-15 minutes)
**Goal**: Verify provider can view and analyze seeker progress

**Key Checkpoints**:
- ✅ Provider sees active engagements
- ✅ Engagement details accessible
- ✅ Session summaries viewable
- ✅ Trajectory status makes sense
- ✅ Stage assignment is correct
- ✅ Progress indicators meaningful

**Expected Outcome**: Provider can effectively monitor seeker progress

## Common Issues and Solutions

### Issue: "useAuth must be used within an AuthProvider"
**Solution**: This should be fixed now. Clear cache and reload. If persists, check that AuthProvider wraps all routes in App.tsx.

### Issue: "JSON object requested, multiple (or no) rows returned"
**Solution**: This was the duplicate role issue. Fixed with migration. If you see this, check database for duplicate roles:
```sql
SELECT user_id, COUNT(*) FROM user_roles GROUP BY user_id HAVING COUNT(*) > 1;
```

### Issue: Can't select role after signup
**Solution**: 
1. Check console for errors
2. Verify user_roles table has unique constraint on user_id
3. Check that RLS policies allow insert

### Issue: AI doesn't respond in chat
**Solution**:
1. Check Network tab for failed requests to chat-reply function
2. Check edge function logs in Lovable Cloud backend
3. Verify LOVABLE_API_KEY is set (automatic in Lovable Cloud)
4. Check selected_model in provider_agent_configs table

### Issue: Session summary not generated
**Solution**:
1. Check if session-finish edge function exists and is deployed
2. Check edge function logs for errors
3. Verify session status changed to 'completed'
4. Check summaries table for entry

### Issue: Provider can't see seeker engagements
**Solution**:
1. Check RLS policies on engagements table
2. Verify engagement has correct provider_id and seeker_id
3. Check that seeker's owner_id matches auth.users.id

## Database Queries for Debugging

### Check User Roles
```sql
SELECT u.email, ur.role, ur.created_at 
FROM auth.users u 
JOIN user_roles ur ON u.id = ur.user_id 
ORDER BY ur.created_at DESC;
```

### Check Provider Configs
```sql
SELECT 
  u.email,
  pc.title,
  pc.methodology,
  pac.selected_model,
  pac.core_identity
FROM provider_configs pc
JOIN provider_agent_configs pac ON pc.provider_id = pac.provider_id
JOIN auth.users u ON pc.provider_id = u.id;
```

### Check Engagements and Sessions
```sql
SELECT 
  e.id as engagement_id,
  p.email as provider_email,
  s_owner.email as seeker_email,
  e.status as engagement_status,
  COUNT(ss.id) as session_count
FROM engagements e
JOIN auth.users p ON e.provider_id = p.id
JOIN seekers s ON e.seeker_id = s.id
JOIN auth.users s_owner ON s.owner_id = s_owner.id
LEFT JOIN sessions ss ON ss.engagement_id = e.id
GROUP BY e.id, p.email, s_owner.email, e.status;
```

### Check Recent Messages
```sql
SELECT 
  m.created_at,
  m.role,
  LEFT(m.content, 50) as content_preview,
  s.id as session_id
FROM messages m
JOIN sessions s ON m.session_id = s.id
ORDER BY m.created_at DESC
LIMIT 20;
```

### Check Summaries
```sql
SELECT 
  su.created_at,
  su.assigned_stage,
  su.trajectory_status,
  LEFT(su.session_summary, 100) as summary_preview,
  se.status as session_status
FROM summaries su
JOIN sessions se ON su.session_id = se.id
ORDER BY su.created_at DESC;
```

## Testing Tips

1. **Take Screenshots**: Document your test execution with screenshots
2. **Note Timestamps**: Record when you complete each workflow
3. **Save Console Logs**: Copy any errors or warnings
4. **Check Network Timing**: Note slow requests (over 5 seconds)
5. **Test Edge Cases**: Try invalid inputs, rapid clicks, etc.
6. **Mobile Testing**: Test on mobile viewport if needed
7. **Browser Testing**: Test in Chrome, Firefox, Safari if possible

## Success Criteria

### All workflows must:
- ✅ Complete without errors
- ✅ Produce expected database entries
- ✅ Show appropriate loading and success states
- ✅ Display accurate data in UI
- ✅ Handle edge cases gracefully
- ✅ Meet security requirements (RLS)

### AI functionality must:
- ✅ Use provider's configuration (tone, voice, principles)
- ✅ Reference provider's stages and labels
- ✅ Generate meaningful summaries
- ✅ Assign appropriate stages
- ✅ Classify trajectory correctly
- ✅ Use selected AI model (Gemini 2.5 Flash by default)

## After Testing

### Document Results
1. Fill out test summary in `test-checklist.md`
2. List all issues found (Critical, Major, Minor)
3. Note any positive observations
4. Suggest improvements

### Report Issues
For each issue, provide:
- **Title**: Brief description
- **Severity**: Critical / Major / Minor
- **Steps to Reproduce**: Detailed steps
- **Expected Result**: What should happen
- **Actual Result**: What actually happens
- **Screenshots**: Visual evidence
- **Console Logs**: Any errors
- **Network Logs**: Failed requests

## Notes on Lovable AI

**Important**: This application uses Lovable AI, which provides access to Google Gemini and OpenAI models without requiring you to provide API keys.

- **No API Key Setup Needed**: The `LOVABLE_API_KEY` is automatically provisioned
- **Available Models**:
  - `google/gemini-2.5-pro` - Most capable, best for complex reasoning
  - `google/gemini-2.5-flash` - **Default**, balanced performance and cost
  - `google/gemini-2.5-flash-lite` - Fastest, best for simple tasks
  - `openai/gpt-5` - OpenAI flagship model
  - `openai/gpt-5-mini` - OpenAI mid-tier model
  - `openai/gpt-5-nano` - OpenAI fastest model

- **Rate Limits**: May see 429 errors if too many requests
- **Usage Limits**: May see 402 errors if credits exhausted

## Questions or Issues?

If you encounter issues during testing:

1. Check this README first
2. Review `e2e-workflows.md` for detailed steps
3. Check console and network tabs
4. Query database to verify state
5. Check edge function logs in Lovable Cloud backend

Happy Testing! 🚀
