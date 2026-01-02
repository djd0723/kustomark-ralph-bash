# Communication Guidelines

How we communicate as a team.

## Communication Channels

### When to Use What

| Channel | Use For | Response Time |
|---------|---------|---------------|
| Slack {{SLACK_CHANNEL}} | Team discussions, questions, updates | Within hours |
| Email | External communication, formal docs | 1-2 business days |
| Jira Comments | Project-specific discussions | Within 1 day |
| GitHub PR Comments | Code review feedback | Within 1 day |
| 1-on-1 Meetings | Personal feedback, career discussions | Weekly |
| Team Meetings | Team decisions, planning | During meeting |
| Emergency | Production incidents | Immediate |

### Slack Guidelines

**Channel Usage:**

- **{{SLACK_CHANNEL}}** - Primary team channel for all team communication
- **#engineering-all** - Cross-team engineering discussions
- **#incidents** - Production incidents only (never mute this!)
- **#random** - Non-work chat and fun

**Best Practices:**

✅ **Do:**
- Use threads to keep conversations organized
- @mention specific people when you need their input
- Use reactions to acknowledge messages
- Set your status when away or busy
- Share wins and accomplishments
- Ask questions openly (others probably have the same question!)

❌ **Don't:**
- Use @channel or @here unless truly urgent
- Send multiple messages when one will do
- Expect immediate responses outside work hours
- DM when public channels are more appropriate
- Send "hello" without context (just ask your question!)

**Writing Effective Messages:**

Good example:
```
Hey team! I'm working on the user authentication feature and running into
an issue with JWT token validation. I've tried X and Y but getting error Z.

Context: [link to PR]
Error: [screenshot or code snippet]

Anyone encountered this before? 🤔
```

Bad example:
```
hey
anyone around?
i have a question
```

### Email Guidelines

**When to Use Email:**
- External communication
- Formal documentation
- Legal/HR matters
- Monthly/quarterly updates

**Email Best Practices:**
- Clear, descriptive subject lines
- Keep it concise
- Use bullet points
- Action items at the top
- CC only necessary people

**Subject Line Examples:**

✅ Good:
- "Action Required: Q1 Planning by Friday"
- "FYI: New deployment process"
- "Question: API authentication approach"

❌ Bad:
- "Important"
- "Quick question"
- "Update"

## Meeting Culture

### Scheduling Meetings

**Before Scheduling:**
- Could this be an email or Slack message?
- Is everyone necessary?
- What's the goal?

**When Scheduling:**
- Set a clear agenda
- Share materials in advance
- Keep to 25 or 50 minutes (buffer time)
- Respect working hours and time zones
- Check calendars first

**Meeting Invite Template:**

```
Title: Clear, specific meeting name

Agenda:
1. Topic 1 (5 min)
2. Topic 2 (10 min)
3. Decisions needed (10 min)

Goal: What we want to accomplish

Pre-read: [Links to documents]

Notes: [Link to shared doc]
```

### During Meetings

**Meeting Roles:**
- **Facilitator** - Runs the meeting, manages time
- **Note-taker** - Documents decisions and action items
- **Participants** - Engaged, prepared, contributing

**Best Practices:**
- Start on time
- Video on (when possible)
- Mute when not speaking
- Stay present (no multitasking)
- Take collaborative notes
- End with clear action items

**Meeting Etiquette:**
- Join 1-2 minutes early
- Use "raise hand" feature
- Don't interrupt
- Be concise
- Respect time limits
- Follow up on action items

### After Meetings

**Required:**
- Share notes in Confluence
- Update Jira with action items
- Send recap to attendees
- Schedule follow-ups if needed

**Notes Template:**

```markdown
# Meeting: [Topic]
Date: [Date]
Attendees: [Names]

## Agenda
1. [Items discussed]

## Decisions
- [Decision 1]
- [Decision 2]

## Action Items
- [ ] [Action] - [Owner] - [Due date]
- [ ] [Action] - [Owner] - [Due date]

## Next Steps
[What happens next]

## Next Meeting
[Date/time if recurring]
```

## Asynchronous Communication

### Why Async?

- Respects different time zones
- Allows thoughtful responses
- Creates documentation
- Reduces meeting time
- Enables deep work

### Async Best Practices

**Writing:**
- Be clear and complete
- Provide context
- Include all relevant links
- State what you need
- Set expectations for response time

**Reading:**
- Check channels regularly
- Respond within expected timeframe
- Use reactions to acknowledge
- Ask clarifying questions
- Follow up on action items

### Decision-Making Async

**For Small Decisions:**

```
📋 Decision needed: [Topic]

Background: [Context]
Options:
  A. [Option A]
  B. [Option B]

React with 👍 for A, 👎 for B
Deadline: [Date/time]
```

**For Larger Decisions:**

1. Create RFC (Request for Comments) document
2. Share in {{SLACK_CHANNEL}}
3. Set comment deadline
4. Discuss asynchronously
5. Make decision
6. Document and communicate

## Working Hours and Availability

### Core Hours

**Team Core Hours:** 10 AM - 4 PM {{OFFICE_LOCATION}} time

During core hours:
- Be available on Slack
- Join synchronous meetings
- Respond to urgent requests

Outside core hours:
- No expectation of availability
- Use "Do Not Disturb"
- Catch up when you're back

### Setting Boundaries

**Communicate Your Schedule:**
- Set working hours in Slack
- Block focus time on calendar
- Update status when stepping away
- Set auto-responder for PTO

**Example Slack Statuses:**
- 🧑‍💻 In deep work (until 3 PM)
- 🌴 On PTO (back Monday)
- 🏠 Working remotely today
- ☕ Taking a break (back at 2 PM)

### On-Call and Emergency Communication

**On-Call Rotation:**
- Weekly rotation
- Documented in PagerDuty
- Secondary on-call backup

**Emergency Escalation:**

```
Level 1: On-call engineer (PagerDuty)
Level 2: Team lead ({{TEAM_LEAD}})
Level 3: Engineering manager
```

**Incident Communication:**
- Post in #incidents immediately
- Update every 15 minutes
- Use incident.io or similar tool
- Document in post-mortem

## Remote Work Communication

### Remote-First Mindset

We operate as a **remote-first** team, meaning:
- Everyone is equal regardless of location
- Default to asynchronous
- Document everything
- Over-communicate

### Video Call Best Practices

**Setup:**
- Good lighting and audio
- Professional background
- Stable internet
- Camera at eye level

**During Calls:**
- Video on when possible
- Mute when not speaking
- Use chat for links/notes
- Speak clearly and pace yourself

### Building Relationships Remotely

**Stay Connected:**
- Virtual coffee chats
- Casual Slack conversations
- Team social events
- Share personal wins

**Water Cooler Moments:**
- Daily standup chat
- "What are you working on?" threads
- Share interesting articles
- Celebrate achievements

## Communication Anti-Patterns

### ❌ Avoid These

**The Mysterious DM:**
```
❌ "hey"
❌ "you around?"
❌ "can I ask you something?"
```

Instead:
```
✅ "Hey! I'm working on X and have a question about Y.
   [context and specific question]
   No rush, whenever you have a moment!"
```

**The Kitchen Sink Email:**
- 10 paragraphs
- No clear ask
- Multiple unrelated topics
- No summary

Instead:
- Clear subject
- TL;DR at top
- Bullet points
- One topic per email

**The Surprise Meeting:**
- No agenda
- No context
- Required attendance
- Back-to-back with other meetings

Instead:
- Clear purpose and agenda
- Pre-reading materials
- Optional attendance when possible
- Calendar buffer time

**The Vague Request:**
```
❌ "Can you review this?"
❌ "Thoughts?"
❌ "Let me know what you think"
```

Instead:
```
✅ "Can you review this PR for security concerns? Specifically
   looking at authentication logic in auth.ts. Need feedback
   by Friday for prod deploy."
```

## Giving and Receiving Feedback

### Giving Feedback

**Framework: SBI (Situation-Behavior-Impact)**

```
Situation: "In yesterday's standup..."
Behavior: "...when you interrupted Sarah..."
Impact: "...she wasn't able to finish her update and seemed discouraged."
```

**Best Practices:**
- Be specific and timely
- Focus on behavior, not person
- Be constructive
- Offer suggestions
- Ask for their perspective

### Receiving Feedback

**Best Practices:**
- Listen actively
- Don't get defensive
- Ask clarifying questions
- Thank the person
- Reflect and act on it

### Feedback Channels

- **Informal:** Slack DM or casual conversation
- **Formal:** 1-on-1 meetings
- **Anonymous:** Feedback forms (link in Confluence)
- **360 Review:** Quarterly review cycles

## Communication Training

### Resources

- Effective Communication workshop
- Writing for Engineers course
- Presentation skills training
- Difficult Conversations workshop

Contact {{TEAM_LEAD}} to sign up.

## Questions?

If you're unsure about the right communication channel or approach, ask in {{SLACK_CHANNEL}} or talk to {{TEAM_LEAD}}.
