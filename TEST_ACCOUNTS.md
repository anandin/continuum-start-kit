# 🧪 Bloom Test Accounts & Scenarios

**All passwords**: `TestPass123!`

---

## 📋 Provider Accounts

### Provider 1: Career Coach
- **Email**: `provider1@bloom.test`
- **Password**: `TestPass123!`
- **Program**: Career Transition Coach
- **AI Model**: `google/gemini-2.5-flash`
- **Seekers**: Seeker 1 (on_track), Seeker 2 (ahead)
- **Specialization**: Career transitions, professional development

### Provider 2: Executive Coach  
- **Email**: `provider2@bloom.test`
- **Password**: `TestPass123!`
- **Program**: Executive Leadership Development
- **AI Model**: `google/gemini-2.5-pro`
- **Seekers**: Seeker 3 (needs_support), Seeker 4 (steady)
- **Specialization**: Leadership, executive presence

### Provider 3: Life Coach
- **Email**: `provider3@bloom.test`
- **Password**: `TestPass123!`
- **Program**: Personal Growth & Wellness Coaching
- **AI Model**: `openai/gpt-5-mini`
- **Seekers**: Seeker 5 (accelerating)
- **Specialization**: Personal growth, work-life balance

---

## 👥 Seeker Accounts

### Seeker 1: Sarah (Career Transition - On Track)
- **Email**: `seeker1@bloom.test`
- **Password**: `TestPass123!`
- **Provider**: Provider 1 (Career Coach)
- **Current Stage**: Skill Development
- **Trajectory**: `on_track`
- **Sessions**: 2 completed
- **Scenario**: Mid-level manager transitioning from software engineering to product management. Making steady progress.

### Seeker 2: Michael (Career Transition - Ahead)
- **Email**: `seeker2@bloom.test`
- **Password**: `TestPass123!`
- **Provider**: Provider 1 (Career Coach)
- **Current Stage**: Job Search & Interviews
- **Trajectory**: `ahead`
- **Sessions**: 3 completed
- **Scenario**: Junior developer excelling in transition to senior role. Already interviewing at top companies.

### Seeker 3: Emma (Executive Development - Needs Support)
- **Email**: `seeker3@bloom.test`
- **Password**: `TestPass123!`
- **Provider**: Provider 2 (Executive Coach)
- **Current Stage**: Executive Presence
- **Trajectory**: `needs_support`
- **Sessions**: 1 completed
- **Scenario**: New VP struggling with stakeholder management and feeling overwhelmed. Needs additional support.

### Seeker 4: David (Executive Development - Steady)
- **Email**: `seeker4@bloom.test`
- **Password**: `TestPass123!`
- **Provider**: Provider 2 (Executive Coach)
- **Current Stage**: Strategic Influence
- **Trajectory**: `steady`
- **Sessions**: 2 completed
- **Scenario**: Director-level exec working on political navigation and cross-functional leadership. Progressing steadily.

### Seeker 5: Lisa (Personal Growth - Accelerating)
- **Email**: `seeker5@bloom.test`
- **Password**: `TestPass123!`
- **Provider**: Provider 3 (Life Coach)
- **Current Stage**: Goal Achievement
- **Trajectory**: `accelerating`
- **Sessions**: 3 completed
- **Scenario**: Entrepreneur rapidly developing mindfulness practices and achieving work-life balance breakthroughs.

---

## 🎭 Test Scenarios

### Scenario 1: Provider View - Multiple Seekers
**Login as**: `provider1@bloom.test`
**What to see**:
- 2 active engagements (Sarah & Michael)
- Sarah showing steady progress (on_track)
- Michael excelling (ahead trajectory)
- Session histories and summaries for both
- Different stages in the career transition journey

### Scenario 2: Provider View - Mixed Progress
**Login as**: `provider2@bloom.test`
**What to see**:
- 2 active engagements (Emma & David)
- Emma flagged as needing support (needs_support)
- David progressing steadily
- Different stages in leadership development
- Opportunity to review and intervene

### Scenario 3: Provider View - Accelerating Seeker
**Login as**: `provider3@bloom.test`
**What to see**:
- 1 active engagement (Lisa)
- Accelerating trajectory
- Multiple completed sessions
- Advanced stage in personal growth journey

### Scenario 4: Seeker View - Struggling
**Login as**: `seeker3@bloom.test` (Emma)
**What to see**:
- Connection to Provider 2
- Current stage: Executive Presence
- Trajectory showing needs_support
- Recent session summary highlighting challenges
- Can start new session to continue journey

### Scenario 5: Seeker View - Excelling
**Login as**: `seeker2@bloom.test` (Michael)
**What to see**:
- Connection to Provider 1
- Advanced stage: Job Search & Interviews
- Ahead trajectory
- Multiple completed sessions showing progress
- Success indicators in summaries

---

## 🔄 Continuing From Test Data

After logging in with any account, you can:

1. **As Provider**:
   - Review all engagement details
   - Check session summaries and trajectories
   - View seeker progress across stages
   - Continue configuring your program or agent

2. **As Seeker**:
   - Start a new session with your provider
   - Continue conversations with AI agent
   - View your session history and summaries
   - See your current stage and trajectory

3. **Testing Edge Cases**:
   - Start incomplete sessions (begin but don't end)
   - Test different conversation patterns
   - Verify trajectory calculations
   - Check stage transitions

---

## 📊 Data Summary

- **Total Users**: 8 (3 providers + 5 seekers)
- **Total Engagements**: 5
- **Total Sessions**: 11 (all completed with summaries)
- **Total Messages**: ~88 (8 messages per session average)
- **AI Models Used**: 3 different models across providers
- **Trajectory Distribution**:
  - 1 accelerating
  - 1 ahead
  - 1 on_track
  - 1 steady  
  - 1 needs_support

---

## 🧪 Testing Checklist

- [ ] Login as each provider and verify dashboard
- [ ] Check engagement details for each provider
- [ ] Review session summaries and trajectories
- [ ] Login as each seeker and verify their view
- [ ] Start new session as a seeker
- [ ] Test AI conversation flow
- [ ] End session and verify summary generation
- [ ] Verify trajectory calculations
- [ ] Test navigation between pages
- [ ] Verify test runner shows all green checkmarks

---

## 🚀 Quick Start Testing

1. Navigate to `/auth` and login with any account above
2. Explore the dashboard appropriate for your role
3. For providers: Click on engagement cards to see details
4. For seekers: Start a new session to continue your journey
5. Use `/test-runner` to validate all scenarios

**Tip**: Keep this document open in a second window for easy reference to credentials!
