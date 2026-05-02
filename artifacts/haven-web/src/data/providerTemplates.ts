export interface ProviderTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  methodology: string;
  stages: Array<{ name: string; description: string }>;
  labels: string[];
  summaryTemplate: string[];
  taggingRules: Record<string, any>;
  trajectoryRules: Array<{
    stage: string;
    indicator_type: 'drift' | 'leap' | 'stall' | 'steady';
    pattern: string;
    message: string;
  }>;
}

export const providerTemplates: ProviderTemplate[] = [
  {
    id: 'cbt-therapist',
    name: 'CBT Therapist',
    description: 'Evidence-based Cognitive Behavioral Therapy framework',
    title: 'CBT Therapy Program',
    methodology: 'This program follows the established CBT framework focused on identifying and restructuring negative thought patterns, developing coping strategies, and creating behavioral change through structured intervention. The approach emphasizes the connection between thoughts, feelings, and behaviors, using evidence-based techniques to help clients achieve measurable therapeutic outcomes.',
    stages: [
      {
        name: 'Assessment & Engagement',
        description: 'Initial evaluation, building therapeutic alliance, and identifying core issues and automatic thoughts'
      },
      {
        name: 'Psychoeducation',
        description: 'Teaching CBT model, explaining the relationship between thoughts-feelings-behaviors, and normalizing experiences'
      },
      {
        name: 'Cognitive Restructuring',
        description: 'Identifying cognitive distortions, challenging negative thoughts, and developing alternative perspectives'
      },
      {
        name: 'Behavioral Activation',
        description: 'Implementing behavioral experiments, activity scheduling, and exposure exercises'
      },
      {
        name: 'Skill Consolidation',
        description: 'Practicing coping strategies, building resilience, and preparing for challenging situations'
      },
      {
        name: 'Relapse Prevention',
        description: 'Developing maintenance plan, identifying warning signs, and establishing ongoing self-monitoring'
      }
    ],
    labels: [
      'cognitive distortions',
      'automatic thoughts',
      'behavioral activation',
      'exposure',
      'thought records',
      'coping skills',
      'anxiety management',
      'mood tracking',
      'homework compliance',
      'relapse prevention'
    ],
    summaryTemplate: [
      'Session Overview: {summary}',
      'Current Stage: {stage}',
      'Cognitive Work: {insights}',
      'Homework Assigned: Review thought records and behavioral experiments',
      'Client Progress: Demonstrated ability to identify and challenge automatic thoughts'
    ],
    taggingRules: {
      keywords: ['catastrophizing', 'black-and-white thinking', 'should statements', 'exposure', 'behavioral experiment'],
      patterns: ['thought record', 'cognitive distortion', 'safety behavior', 'avoidance pattern']
    },
    trajectoryRules: [
      {
        stage: 'Cognitive Restructuring',
        indicator_type: 'leap',
        pattern: 'successfully challenged core belief|identified alternative perspective|reduced distortion',
        message: 'Strong cognitive breakthrough - client demonstrating advanced restructuring skills'
      },
      {
        stage: 'Behavioral Activation',
        indicator_type: 'drift',
        pattern: 'avoided exposure|canceled activity|increased safety behaviors',
        message: 'Avoidance pattern emerging - revisit behavioral activation rationale'
      },
      {
        stage: 'Skill Consolidation',
        indicator_type: 'steady',
        pattern: 'using coping skills|applying techniques|monitoring thoughts',
        message: 'Consistent skill application - ready for relapse prevention planning'
      }
    ]
  },
  {
    id: 'executive-coach',
    name: 'Executive Coach',
    description: 'Leadership development for senior executives and high-performers',
    title: 'Executive Leadership Development',
    methodology: 'Integrative executive coaching approach combining leadership presence models, stakeholder-centered coaching, and evidence-based leadership development. Focus areas include executive presence, assertive leadership, navigating organizational politics, strategic thinking, and high-stakes decision making. Utilizes 360-degree feedback, behavioral assessments, and real-time workplace application.',
    stages: [
      {
        name: 'Leadership Assessment',
        description: 'Conducting 360 reviews, identifying leadership gaps, and establishing development priorities'
      },
      {
        name: 'Executive Presence',
        description: 'Building gravitas, communication impact, and authentic leadership style'
      },
      {
        name: 'Strategic Influence',
        description: 'Mastering organizational politics, stakeholder management, and cross-functional leadership'
      },
      {
        name: 'Assertive Leadership',
        description: 'Developing decisive communication, boundary setting, and confident decision-making'
      },
      {
        name: 'Team & Culture Mastery',
        description: 'Leading organizational change, building high-performing teams, and shaping culture'
      },
      {
        name: 'Sustained Excellence',
        description: 'Maintaining peak performance, work-life integration, and continuous leadership evolution'
      }
    ],
    labels: [
      'executive presence',
      'strategic thinking',
      'stakeholder management',
      'organizational politics',
      'assertive communication',
      'decision making',
      'team leadership',
      'change management',
      'work-life balance',
      'emotional intelligence',
      'conflict resolution',
      'influence tactics'
    ],
    summaryTemplate: [
      'Session Focus: {summary}',
      'Leadership Stage: {stage}',
      'Key Competencies: {insights}',
      'Action Items: Apply new strategies in upcoming board meeting and team session',
      'Progress Indicators: Demonstrating increased confidence in high-stakes situations'
    ],
    taggingRules: {
      keywords: ['board meeting', 'direct reports', 'C-suite', 'stakeholder', 'influence', 'presence', 'politics'],
      patterns: ['difficult conversation', 'strategic decision', 'organizational challenge', 'leadership moment']
    },
    trajectoryRules: [
      {
        stage: 'Executive Presence',
        indicator_type: 'leap',
        pattern: 'received positive feedback|demonstrated gravitas|commanded room',
        message: 'Significant presence breakthrough - client showing authentic leadership voice'
      },
      {
        stage: 'Strategic Influence',
        indicator_type: 'drift',
        pattern: 'avoided difficult conversation|bypassed key stakeholder|missed political opportunity',
        message: 'Influence gap appearing - explore fears around political navigation'
      },
      {
        stage: 'Assertive Leadership',
        indicator_type: 'steady',
        pattern: 'set clear boundaries|made decisive call|communicated expectations',
        message: 'Consistent assertiveness - building sustainable leadership patterns'
      }
    ]
  },
  {
    id: 'spiritual-leader',
    name: 'Spiritual Leader',
    description: 'Consciousness expansion and spiritual awakening guidance',
    title: 'Spiritual Awakening Journey',
    methodology: 'Integrative spiritual development framework drawing from Dr. Joe Dispenza\'s neuroscience-based transformation, Deepak Chopra\'s consciousness teachings, Sadhguru\'s yogic wisdom, Dolores Cannon\'s quantum healing hypnosis, and Bashar\'s higher consciousness principles. Focuses on raising vibration, dissolving limiting beliefs, accessing higher states of consciousness, and aligning with authentic soul purpose.',
    stages: [
      {
        name: 'Awakening & Awareness',
        description: 'Initial spiritual opening, recognizing patterns, and beginning to question conditioned reality'
      },
      {
        name: 'Shadow Integration',
        description: 'Confronting and healing past traumas, releasing energetic blocks, and embracing shadow aspects'
      },
      {
        name: 'Vibrational Mastery',
        description: 'Learning to consciously shift frequency, maintain high vibration, and embody desired states'
      },
      {
        name: 'Quantum Leap',
        description: 'Breaking through old paradigms, accessing higher timelines, and manifesting new reality'
      },
      {
        name: 'Soul Alignment',
        description: 'Living from authentic purpose, following inner guidance, and co-creating with universe'
      },
      {
        name: 'Service & Embodiment',
        description: 'Grounded spiritual integration, serving others, and anchoring higher consciousness'
      }
    ],
    labels: [
      'consciousness expansion',
      'energy work',
      'meditation practice',
      'limiting beliefs',
      'higher self connection',
      'manifestation',
      'vibrational frequency',
      'shadow work',
      'quantum healing',
      'spiritual purpose',
      'inner peace',
      'divine guidance'
    ],
    summaryTemplate: [
      'Session Energy: {summary}',
      'Consciousness Level: {stage}',
      'Transformational Themes: {insights}',
      'Practice: Daily meditation, energy clearing, and vibrational alignment exercises',
      'Soul Progress: Deepening connection to higher self and expanding awareness'
    ],
    taggingRules: {
      keywords: ['meditation', 'energy', 'vibration', 'consciousness', 'quantum', 'manifestation', 'higher self'],
      patterns: ['spiritual experience', 'breakthrough moment', 'resistance pattern', 'energetic shift']
    },
    trajectoryRules: [
      {
        stage: 'Vibrational Mastery',
        indicator_type: 'leap',
        pattern: 'sustained high vibration|manifested desired outcome|accessed flow state',
        message: 'Powerful vibrational shift - client mastering frequency control'
      },
      {
        stage: 'Shadow Integration',
        indicator_type: 'drift',
        pattern: 'avoiding shadow work|resisting healing|staying in victim consciousness',
        message: 'Shadow resistance surfacing - gentle encouragement toward deeper work'
      },
      {
        stage: 'Soul Alignment',
        indicator_type: 'steady',
        pattern: 'following guidance|trusting process|living authentically',
        message: 'Beautiful alignment - soul purpose emerging clearly'
      }
    ]
  },
  {
    id: 'divorce-lawyer',
    name: 'Divorce Lawyer',
    description: 'Family law practice focused on divorce proceedings',
    title: 'Divorce Legal Services',
    methodology: 'Comprehensive divorce legal representation covering all aspects of marital dissolution including asset division, custody arrangements, spousal support, and settlement negotiations. Approach balances aggressive advocacy with pragmatic settlement strategies, always prioritizing client\'s long-term interests and emotional wellbeing throughout the legal process.',
    stages: [
      {
        name: 'Initial Consultation',
        description: 'Case evaluation, explaining legal process, gathering financial documents, and setting expectations'
      },
      {
        name: 'Filing & Response',
        description: 'Preparing and filing petition, serving spouse, and responding to counter-petitions'
      },
      {
        name: 'Discovery & Disclosure',
        description: 'Financial disclosure, interrogatories, depositions, and gathering evidence'
      },
      {
        name: 'Negotiation & Mediation',
        description: 'Settlement discussions, mediation sessions, and exploring resolution options'
      },
      {
        name: 'Trial Preparation',
        description: 'If settlement fails - preparing for court, organizing evidence, and witness preparation'
      },
      {
        name: 'Final Resolution',
        description: 'Executing settlement agreement or judgment, finalizing custody orders, and post-decree matters'
      }
    ],
    labels: [
      'asset division',
      'child custody',
      'spousal support',
      'property valuation',
      'parenting plan',
      'financial disclosure',
      'mediation',
      'settlement negotiation',
      'court filing',
      'temporary orders',
      'pension division',
      'debt allocation'
    ],
    summaryTemplate: [
      'Case Status: {summary}',
      'Current Phase: {stage}',
      'Key Issues: {insights}',
      'Next Steps: Complete financial disclosures and schedule mediation session',
      'Legal Strategy: Focus on equitable property division while protecting client\'s parental rights'
    ],
    taggingRules: {
      keywords: ['custody', 'alimony', 'asset', 'property', 'mediation', 'settlement', 'support', 'visitation'],
      patterns: ['opposing counsel', 'court deadline', 'financial disclosure', 'custody dispute']
    },
    trajectoryRules: [
      {
        stage: 'Negotiation & Mediation',
        indicator_type: 'leap',
        pattern: 'reached settlement|agreed on terms|breakthrough in mediation',
        message: 'Positive settlement progress - maintaining momentum toward resolution'
      },
      {
        stage: 'Discovery & Disclosure',
        indicator_type: 'drift',
        pattern: 'missing documents|spouse non-compliant|discovery delays',
        message: 'Discovery complications - may need to file motion to compel'
      },
      {
        stage: 'Final Resolution',
        indicator_type: 'steady',
        pattern: 'documents executed|orders entered|decree finalized',
        message: 'Case proceeding to closure - preparing final paperwork'
      }
    ]
  },
  {
    id: 'blank',
    name: 'Start from Scratch',
    description: 'Create your own custom framework',
    title: '',
    methodology: '',
    stages: [{ name: '', description: '' }],
    labels: [''],
    summaryTemplate: ['Session Overview: {summary}', 'Current Stage: {stage}', 'Key Insights: {insights}'],
    taggingRules: {},
    trajectoryRules: [{ stage: '', indicator_type: 'steady', pattern: '', message: '' }]
  }
];
