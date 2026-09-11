import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = process.env.CVELOCITY_ROOT || '/opt/cvelocity-lab/repo';
const LAB = path.join(ROOT, '.cvelocity-lab');

const DIRS = {
  corpus: path.join(LAB, 'corpus'),
  rejected: path.join(LAB, 'rejected'),
  failures: path.join(LAB, 'failures'),
  parserErrors: path.join(LAB, 'parser-errors'),
  proposals: path.join(LAB, 'proposals'),
  validated: path.join(LAB, 'validated_proposals'),
  reports: path.join(LAB, 'reports'),
  logs: path.join(LAB, 'logs'),
  tmp: path.join(LAB, 'tmp'),
  generatedTests: path.join(LAB, 'generated-tests'),
};

const OLLAMA =
  process.env.OLLAMA_URL ||
  'http://192.168.1.170:11434';

const GENERATOR =
  process.env.GENERATOR_MODEL ||
  'oathcry-twin:latest';

const CRITIC =
  process.env.CRITIC_MODEL ||
  'oathcry-twin-classic:latest';

const CODER =
  process.env.CODE_MODEL ||
  'qwen-code:latest';

const DELAY_MS =
  Number(process.env.DELAY_MS || 5000);

const TEST_EVERY =
  Number(process.env.TEST_EVERY || 20);

const FULL_TEST_EVERY =
  Number(process.env.FULL_TEST_EVERY || 100);

const REPORT_EVERY =
  Number(process.env.REPORT_EVERY || 25);

const PROPOSAL_FAILURE_BATCH =
  Number(process.env.PROPOSAL_FAILURE_BATCH || 3);

const MAX_RETRIES =
  Number(process.env.MAX_RETRIES || 3);

const MIN_CRITIC_CONFIDENCE =
  Number(process.env.MIN_CRITIC_CONFIDENCE || 0.72);

const MIN_JUDGE_CONFIDENCE =
  Number(process.env.MIN_JUDGE_CONFIDENCE || 0.65);

const KEEP_ALIVE =
  process.env.OLLAMA_KEEP_ALIVE ||
  '5m';

const CONFUSION_RATE =
  Number(process.env.CONFUSION_RATE || 0.35);

const MIN_FREE_DISK_MB =
  Number(process.env.MIN_FREE_DISK_MB || 750);

const STATE_FILE =
  path.join(LAB, 'state.json');

const LOG_FILE =
  path.join(DIRS.logs, 'trainer.log');

const HEARTBEAT =
  '/opt/cvelocity-lab/heartbeat';

const HEARTBEAT_JSON =
  path.join(LAB, 'heartbeat.json');

const LOCK_FILE =
  path.join(LAB, 'trainer.pid');

const LEARNED_MEMORY_FILE =
  path.join(LAB, 'learned-memory.json');

const PARSER_PROBE =
  path.join(LAB, 'parser-probe.ts');

const TSX_BIN =
  path.join(ROOT, 'node_modules', '.bin', 'tsx');

const VITEST_BIN =
  path.join(ROOT, 'node_modules', '.bin', 'vitest');

let stopping = false;
let lockOwned = false;


const DOMAIN_POOLS = {

  microsoft_it: {
    weight: 13,
    concepts: [
      'Microsoft 365',
      'Exchange Online',
      'Entra ID',
      'Active Directory',
      'Microsoft Intune',
      'PowerShell',
      'Azure',
      'Azure AD Connect',
      'Entra Connect',
      'IAM',
      'MFA',
      'Conditional Access',
      'Shared Mailbox',
      'Mailbox Permissions',
      'Send As',
      'Send on Behalf',
      'Mail Flow',
      'Exchange Transport Rules',
      'Distribution Groups',
      'Microsoft 365 Groups',
      'Microsoft Defender for Office 365',
      'Exchange Online Protection',
      'Windows administration',
      'Linux administration',
      'technical support',
      'help desk',
      'incident management',
      'problem management',
      'ITIL',
      'ServiceNow',
      'Jira',
      'network troubleshooting',
      'DNS',
      'DHCP',
      'VPN',
      'TCP/IP',
      'firewalls',
      'virtualization',
      'VMware',
      'Proxmox'
    ]
  },

  cybersecurity: {
    weight: 10,
    concepts: [
      'SOC',
      'SIEM',
      'EDR',
      'XDR',
      'Microsoft Sentinel',
      'Microsoft Defender',
      'incident response',
      'phishing analysis',
      'malware analysis',
      'vulnerability management',
      'identity security',
      'access control',
      'privileged access management',
      'Zero Trust',
      'security hardening',
      'risk assessment',
      'security monitoring',
      'threat hunting',
      'threat intelligence',
      'log analysis',
      'ISO 27001',
      'NIST',
      'OWASP',
      'penetration testing',
      'security awareness',
      'DLP',
      'email security',
      'endpoint security'
    ]
  },

  software_engineering: {
    weight: 10,
    concepts: [
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'Python',
      'Java',
      'C#',
      '.NET',
      'PHP',
      'Go',
      'Rust',
      'frontend development',
      'backend development',
      'full stack development',
      'API integration',
      'REST API',
      'GraphQL',
      'microservices',
      'unit testing',
      'integration testing',
      'end-to-end testing',
      'CI/CD',
      'GitHub Actions',
      'GitLab CI',
      'Docker',
      'Kubernetes',
      'Git',
      'code review',
      'debugging',
      'software architecture',
      'design patterns',
      'SQL',
      'PostgreSQL',
      'MySQL',
      'MongoDB'
    ]
  },

  data_analytics: {
    weight: 8,
    concepts: [
      'data analysis',
      'business intelligence',
      'Power BI',
      'Tableau',
      'Excel',
      'advanced Excel',
      'Python',
      'Pandas',
      'NumPy',
      'data visualization',
      'ETL',
      'ELT',
      'data cleaning',
      'data transformation',
      'data quality',
      'reporting',
      'dashboarding',
      'KPI analysis',
      'statistical analysis',
      'forecasting',
      'data modeling',
      'SQL',
      'DAX',
      'Power Query',
      'data warehousing'
    ]
  },

  business_product_project: {
    weight: 8,
    concepts: [
      'business analysis',
      'requirements gathering',
      'requirements analysis',
      'stakeholder management',
      'process mapping',
      'process improvement',
      'BPMN',
      'UML',
      'gap analysis',
      'business requirements',
      'functional requirements',
      'user stories',
      'acceptance criteria',
      'workshops',
      'change management',
      'project coordination',
      'project management',
      'product management',
      'product discovery',
      'roadmapping',
      'Scrum',
      'Kanban',
      'risk management',
      'vendor management',
      'SLA management',
      'KPI management',
      'documentation'
    ]
  },

  finance_banking_compliance: {
    weight: 8,
    concepts: [
      'AML',
      'KYC',
      'customer due diligence',
      'enhanced due diligence',
      'transaction monitoring',
      'sanctions screening',
      'PEP screening',
      'fraud detection',
      'fraud prevention',
      'financial analysis',
      'financial reporting',
      'reconciliation',
      'operational risk',
      'credit risk',
      'compliance',
      'regulatory reporting',
      'internal controls',
      'audit',
      'banking operations',
      'payments',
      'SEPA',
      'SWIFT',
      'collections',
      'accounts payable',
      'accounts receivable',
      'controlling',
      'budgeting'
    ]
  },

  sales_customer_service: {
    weight: 7,
    concepts: [
      'sales',
      'B2B sales',
      'B2C sales',
      'account management',
      'key account management',
      'customer success',
      'customer service',
      'CRM',
      'Salesforce',
      'HubSpot',
      'lead generation',
      'prospecting',
      'negotiation',
      'upselling',
      'cross-selling',
      'retention',
      'pipeline management',
      'relationship management',
      'complaint handling',
      'call center'
    ]
  },

  marketing_media_design: {
    weight: 6,
    concepts: [
      'digital marketing',
      'SEO',
      'SEM',
      'Google Ads',
      'Meta Ads',
      'content marketing',
      'social media marketing',
      'email marketing',
      'marketing automation',
      'campaign management',
      'copywriting',
      'brand management',
      'market research',
      'Google Analytics',
      'conversion optimization',
      'lead nurturing',
      'graphic design',
      'Adobe Photoshop',
      'Adobe Illustrator',
      'Figma',
      'UX design',
      'UI design'
    ]
  },

  hr_legal_administration: {
    weight: 6,
    concepts: [
      'recruitment',
      'talent acquisition',
      'candidate screening',
      'candidate sourcing',
      'interviewing',
      'onboarding',
      'HR administration',
      'employee relations',
      'performance management',
      'learning and development',
      'training',
      'HRIS',
      'payroll coordination',
      'workforce planning',
      'office administration',
      'office management',
      'document management',
      'records management',
      'contract administration',
      'legal research',
      'GDPR',
      'data protection'
    ]
  },

  logistics_supply_chain_retail: {
    weight: 6,
    concepts: [
      'logistics',
      'supply chain',
      'inventory management',
      'warehouse management',
      'procurement',
      'transport planning',
      'order management',
      'demand planning',
      'production planning',
      'ERP',
      'SAP',
      'vendor management',
      'stock control',
      'shipping',
      'retail sales',
      'cash handling',
      'merchandising',
      'store operations',
      'customer checkout'
    ]
  },

  engineering_manufacturing_trades: {
    weight: 7,
    concepts: [
      'CAD',
      'AutoCAD',
      'SolidWorks',
      'technical drawing',
      'maintenance',
      'preventive maintenance',
      'corrective maintenance',
      'PLC',
      'industrial automation',
      'production engineering',
      'quality control',
      'quality assurance',
      'manufacturing',
      'CNC',
      'electrical engineering',
      'mechanical engineering',
      'welding',
      'electrical installation',
      'HVAC',
      'construction supervision',
      'machine operation',
      'forklift operation'
    ]
  },

  healthcare_education_public: {
    weight: 5,
    concepts: [
      'patient administration',
      'medical documentation',
      'clinical support',
      'nursing',
      'pharmacy operations',
      'laboratory work',
      'public administration',
      'case management',
      'teaching',
      'training delivery',
      'curriculum development',
      'research',
      'student support',
      'social services',
      'records management'
    ]
  },

  hospitality_food_services: {
    weight: 3,
    concepts: [
      'hospitality',
      'hotel reception',
      'reservation management',
      'restaurant service',
      'food preparation',
      'food safety',
      'HACCP',
      'bar service',
      'event service',
      'housekeeping',
      'guest relations',
      'shift supervision'
    ]
  }

};


const ATTACKS = [

  'false_negative',
  'false_negative',
  'false_negative',
  'false_negative',

  'false_positive',
  'false_positive',
  'false_positive',

  'synonym',
  'historic_name',
  'abbreviation',

  'related_not_equivalent',

  'ambiguous_wording',

  'transferable_skill',

  'tool_vs_skill',

  'task_vs_ownership',

  'user_vs_admin',

  'exposure_vs_experience',

  'basic_vs_advanced',

  'assisted_vs_independent',

  'team_experience_vs_personal_experience',

  'course_vs_commercial_experience',

  'project_vs_production',

  'internship_vs_full_role',

  'ambiguous_seniority',

  'overlapping_skills',

  'domain_transfer',

  'section_heading_noise',

  'ocr_noise',

  'bilingual_cv',

  'negation_trap',

  'keyword_stuffing'

];


const CONFUSION_PAIRS = [

  ['Outlook', 'Exchange Online'],

  ['Microsoft 365', 'Exchange Online'],

  ['Azure', 'Entra ID'],

  ['Active Directory', 'Entra ID'],

  ['Azure AD', 'Entra ID'],

  ['Azure AD Connect', 'Entra Connect'],

  ['PowerShell', 'Microsoft 365 administration'],

  ['PowerShell', 'Exchange Online administration'],

  ['Shared Mailbox', 'Mailbox Permissions'],

  ['FullAccess', 'Send As'],

  ['Send As', 'Send on Behalf'],

  ['Distribution Group', 'Microsoft 365 Group'],

  ['Inbox Rule', 'Exchange Transport Rule'],

  ['Exchange Online Protection', 'Defender for Office 365'],

  ['MFA', 'Conditional Access'],

  ['Intune', 'Entra ID'],

  ['Docker', 'Kubernetes'],

  ['Linux', 'DevOps'],

  ['Git', 'CI/CD'],

  ['REST API', 'backend development'],

  ['SQL', 'database administration'],

  ['Python', 'data analysis'],

  ['Excel', 'business intelligence'],

  ['Power BI', 'data engineering'],

  ['Salesforce user', 'Salesforce administrator'],

  ['CRM user', 'CRM administrator'],

  ['AML exposure', 'AML analyst'],

  ['KYC', 'AML'],

  ['transaction monitoring', 'fraud investigation'],

  ['recruitment coordination', 'talent acquisition'],

  ['candidate screening', 'technical recruitment'],

  ['customer service', 'customer success'],

  ['account management', 'sales'],

  ['SEO', 'SEM'],

  ['Google Analytics', 'data analysis'],

  ['project coordination', 'project management'],

  ['requirements gathering', 'business analysis'],

  ['documentation', 'technical writing'],

  ['SAP user', 'SAP consultant'],

  ['ERP user', 'ERP administrator'],

  ['AutoCAD', 'mechanical engineering'],

  ['PLC exposure', 'PLC programming'],

  ['nursing support', 'registered nurse'],

  ['food preparation', 'chef'],

  ['cash handling', 'accounting']

];


const LANGUAGES = [

  {
    value: 'pl',
    weight: 55
  },

  {
    value: 'en',
    weight: 30
  },

  {
    value: 'mixed_pl_en',
    weight: 12
  },

  {
    value: 'de',
    weight: 3
  }

];


const STYLES = [

  'classic_cv',

  'compact_bullets',

  'narrative',

  'minimalist',

  'two_column_text',

  'odd_headings',

  'markdown_like',

  'ats_unfriendly',

  'ocr_imperfect',

  'skills_hidden_in_experience',

  'skills_section_only',

  'mixed_sections'

];


const CLASSIFICATIONS = [

  'SUPPORTED',

  'PARTIAL',

  'UNSUPPORTED',

  'AMBIGUOUS'

];


const GENERATOR_SCHEMA = {

  type: 'object',

  properties: {

    domain: {
      type: 'string'
    },

    target_concept: {
      type: 'string'
    },

    cv_text: {
      type: 'string'
    },

    expected: {
      type: 'string',
      enum: CLASSIFICATIONS
    },

    attack_type: {
      type: 'string',
      enum: [...new Set(ATTACKS)]
    },

    language: {
      type: 'string'
    },

    style: {
      type: 'string'
    },

    difficulty: {
      type: 'integer',
      minimum: 1,
      maximum: 5
    },

    reason: {
      type: 'string'
    },

    positive_evidence: {
      type: 'array',
      items: {
        type: 'string'
      }
    },

    negative_evidence: {
      type: 'array',
      items: {
        type: 'string'
      }
    },

    confusion_with: {
      type: 'string'
    }

  },

  required: [

    'domain',

    'target_concept',

    'cv_text',

    'expected',

    'attack_type',

    'language',

    'style',

    'difficulty',

    'reason',

    'positive_evidence',

    'negative_evidence',

    'confusion_with'

  ]

};


const CRITIC_SCHEMA = {

  type: 'object',

  properties: {

    valid_case: {
      type: 'boolean'
    },

    corrected_expected: {
      type: 'string',
      enum: CLASSIFICATIONS
    },

    confidence: {
      type: 'number'
    },

    useful_for_training: {
      type: 'boolean'
    },

    source_truth_is_clear: {
      type: 'boolean'
    },

    reason: {
      type: 'string'
    },

    ambiguity_reason: {
      type: 'string'
    },

    leakage_or_unrealism: {
      type: 'boolean'
    }

  },

  required: [

    'valid_case',

    'corrected_expected',

    'confidence',

    'useful_for_training',

    'source_truth_is_clear',

    'reason',

    'ambiguity_reason',

    'leakage_or_unrealism'

  ]

};


const PARSER_JUDGE_SCHEMA = {

  type: 'object',

  properties: {

    actual: {
      type: 'string',
      enum: CLASSIFICATIONS
    },

    confidence: {
      type: 'number'
    },

    evidence: {
      type: 'array',
      items: {
        type: 'string'
      }
    },

    reason: {
      type: 'string'
    }

  },

  required: [

    'actual',

    'confidence',

    'evidence',

    'reason'

  ]

};


const PROPOSAL_SCHEMA = {

  type: 'object',

  properties: {

    proposal_type: {

      type: 'string',

      enum: [

        'alias',

        'negative_relation',

        'heading_pattern',

        'normalization',

        'skill_boundary',

        'skill_extraction',

        'parser_structure',

        'other'

      ]

    },

    title: {
      type: 'string'
    },

    diagnosis: {
      type: 'string'
    },

    proposed_change: {
      type: 'string'
    },

    candidate_aliases: {

      type: 'array',

      items: {
        type: 'string'
      }

    },

    negative_relations: {

      type: 'array',

      items: {
        type: 'string'
      }

    },

    regression_test: {
      type: 'string'
    },

    risk: {

      type: 'string',

      enum: [

        'low',

        'medium',

        'high'

      ]

    },

    confidence: {
      type: 'number'
    },

    source_failure_ids: {

      type: 'array',

      items: {
        type: 'string'
      }

    }

  },

  required: [

    'proposal_type',

    'title',

    'diagnosis',

    'proposed_change',

    'candidate_aliases',

    'negative_relations',

    'regression_test',

    'risk',

    'confidence',

    'source_failure_ids'

  ]

};


const PROPOSAL_REVIEW_SCHEMA = {

  type: 'object',

  properties: {

    valid: {
      type: 'boolean'
    },

    confidence: {
      type: 'number'
    },

    risk: {

      type: 'string',

      enum: [

        'low',

        'medium',

        'high'

      ]

    },

    action: {

      type: 'string',

      enum: [

        'shadow_accept',

        'reject',

        'needs_more_data'

      ]

    },

    reason: {
      type: 'string'
    }

  },

  required: [

    'valid',

    'confidence',

    'risk',

    'action',

    'reason'

  ]

};


function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );

}


function randomItem(items) {

  return items[
    Math.floor(
      Math.random() *
      items.length
    )
  ];

}


function weightedChoice(items) {

  const total =
    items.reduce(
      (sum, item) =>
        sum + item.weight,
      0
    );

  let cursor =
    Math.random() *
    total;


  for (
    const item
    of items
  ) {

    cursor -=
      item.weight;


    if (
      cursor <= 0
    ) {

      return item.value;

    }

  }


  return items.at(-1).value;

}


function weightedRandomDomain() {

  const entries =
    Object.entries(
      DOMAIN_POOLS
    );


  const total =
    entries.reduce(
      (sum, [, value]) =>
        sum + value.weight,
      0
    );


  let cursor =
    Math.random() *
    total;


  for (
    const [name, value]
    of entries
  ) {

    cursor -=
      value.weight;


    if (
      cursor <= 0
    ) {

      return {

        name,

        concepts:
          value.concepts

      };

    }

  }


  const [name, value] =
    entries.at(-1);


  return {

    name,

    concepts:
      value.concepts

  };

}


function normalizeText(value) {

  return String(
    value || ''
  )

    .normalize('NFKD')

    .replace(
      /[\u0300-\u036f]/g,
      ''
    )

    .toLowerCase()

    .replace(
      /[^a-z0-9+#.]+/g,
      ' '
    )

    .replace(
      /\s+/g,
      ' '
    )

    .trim();

}


function fingerprint(value) {

  return crypto

    .createHash(
      'sha256'
    )

    .update(
      JSON.stringify(
        value
      )
    )

    .digest(
      'hex'
    );

}


function makeId(prefix = '') {

  return `${prefix}${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

}


async function atomicWrite(
  file,
  content
) {

  const temp =
    `${file}.${process.pid}.${Date.now()}.tmp`;


  await fs.writeFile(
    temp,
    content
  );


  await fs.rename(
    temp,
    file
  );

}


async function writeJson(
  file,
  value
) {

  await atomicWrite(

    file,

    JSON.stringify(
      value,
      null,
      2
    )

  );

}


async function readJson(
  file,
  fallback
) {

  try {

    return JSON.parse(
      await fs.readFile(
        file,
        'utf8'
      )
    );

  } catch {

    return fallback;

  }

}


async function log(message) {

  const line =
    `[${new Date().toISOString()}] ${message}\n`;


  process.stdout.write(
    line
  );


  await fs.appendFile(
    LOG_FILE,
    line
  ).catch(
    () => {}
  );

}


async function rotateLogIfNeeded() {

  try {

    const stat =
      await fs.stat(
        LOG_FILE
      );


    if (
      stat.size <
      25 * 1024 * 1024
    ) {

      return;

    }


    const rotated =
      path.join(
        DIRS.logs,
        `trainer-${Date.now()}.log`
      );


    await fs.rename(
      LOG_FILE,
      rotated
    );

  } catch {}

}


function defaultState() {

  return {

    schemaVersion: 3,

    iteration: 0,

    generated: 0,

    accepted: 0,

    rejected: 0,

    duplicates: 0,

    parserRuns: 0,

    parserErrors: 0,

    parserMatches: 0,

    parserDisagreements: 0,

    highSeverityFailures: 0,

    modelErrors: 0,

    focusedTestRuns: 0,

    focusedTestFailures: 0,

    fullTestRuns: 0,

    fullTestFailures: 0,

    proposals: 0,

    validatedProposals: 0,

    lastProposalFailureCount: 0,

    consecutiveErrors: 0,

    startedAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),

    coverage: {

      domains: {},

      attacks: {},

      expected: {},

      actual: {},

      failureTypes: {}

    }

  };

}


function normalizeState(existing) {

  const fresh =
    defaultState();


  const state = {

    ...fresh,

    ...(existing || {})

  };


  state.coverage = {

    domains: {

      ...fresh.coverage.domains,

      ...(existing?.coverage?.domains || {})

    },

    attacks: {

      ...fresh.coverage.attacks,

      ...(existing?.coverage?.attacks || {})

    },

    expected: {

      ...fresh.coverage.expected,

      ...(existing?.coverage?.expected || {})

    },

    actual: {

      ...fresh.coverage.actual,

      ...(existing?.coverage?.actual || {})

    },

    failureTypes: {

      ...fresh.coverage.failureTypes,

      ...(existing?.coverage?.failureTypes || {})

    }

  };


  return state;

}


function bump(
  map,
  key
) {

  const safe =
    key ||
    'unknown';


  map[safe] =
    (
      map[safe] ||
      0
    ) + 1;

}


async function saveState(state) {

  state.updatedAt =
    new Date().toISOString();


  await writeJson(
    STATE_FILE,
    state
  );

}


async function heartbeat(
  state,
  phase
) {

  const now =
    Date.now();


  await fs.writeFile(
    HEARTBEAT,
    String(now)
  );


  await writeJson(

    HEARTBEAT_JSON,

    {

      timestamp:
        now,

      iso:
        new Date(
          now
        ).toISOString(),

      pid:
        process.pid,

      iteration:
        state?.iteration ?? 0,

      phase,

      generator:
        GENERATOR,

      critic:
        CRITIC,

      coder:
        CODER

    }

  );

}


async function acquireLock() {

  await fs.mkdir(
    LAB,
    {
      recursive: true
    }
  );


  try {

    const oldPid =
      Number(
        (
          await fs.readFile(
            LOCK_FILE,
            'utf8'
          )
        ).trim()
      );


    if (
      Number.isFinite(
        oldPid
      ) &&
      oldPid > 1
    ) {

      try {

        process.kill(
          oldPid,
          0
        );


        throw new Error(
          `Trainer already running with PID ${oldPid}`
        );

      } catch (error) {

        if (
          error?.code !==
          'ESRCH'
        ) {

          throw error;

        }

      }

    }


    await fs.unlink(
      LOCK_FILE
    ).catch(
      () => {}
    );

  } catch (error) {

    if (
      error?.code !==
      'ENOENT'
    ) {

      throw error;

    }

  }


  await fs.writeFile(

    LOCK_FILE,

    String(
      process.pid
    ),

    {
      flag: 'wx'
    }

  );


  lockOwned =
    true;

}


function cleanupLockSync() {

  if (
    !lockOwned
  ) {

    return;

  }


  try {

    const current =
      Number(
        fsSync
          .readFileSync(
            LOCK_FILE,
            'utf8'
          )
          .trim()
      );


    if (
      current ===
      process.pid
    ) {

      fsSync.unlinkSync(
        LOCK_FILE
      );

    }

  } catch {}

}


async function createParserProbe() {

  const source =
`import fs from 'node:fs';
import { parseTextToMasterVault } from '../src/lib/cvUniversalParser.ts';

const input = process.argv[2];

if (!input) {
  throw new Error('Missing input path');
}

const text =
  fs.readFileSync(
    input,
    'utf8'
  );

const parsed =
  parseTextToMasterVault(
    text,
    'TXT'
  );

console.log(
  '__CVELOCITY_JSON__' +
  JSON.stringify(parsed)
);
`;


  await fs.writeFile(
    PARSER_PROBE,
    source
  );

}


async function init() {

  for (
    const dir
    of Object.values(DIRS)
  ) {

    await fs.mkdir(
      dir,
      {
        recursive: true
      }
    );

  }


  await acquireLock();


  await createParserProbe();


  if (
    !fsSync.existsSync(
      LEARNED_MEMORY_FILE
    )
  ) {

    await writeJson(

      LEARNED_MEMORY_FILE,

      {

        version: 1,

        updated_at:
          new Date().toISOString(),

        proposals: []

      }

    );

  }

}


function runCommand(
  command,
  args,
  {
    cwd = ROOT,
    timeout = 600000,
    env = process.env
  } = {}
) {

  return new Promise(
    resolve => {

      const proc =
        spawn(
          command,
          args,
          {

            cwd,

            env,

            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]

          }
        );


      let stdout = '';

      let stderr = '';


      proc.stdout.on(
        'data',
        d => {

          stdout +=
            d.toString();

        }
      );


      proc.stderr.on(
        'data',
        d => {

          stderr +=
            d.toString();

        }
      );


      const timer =
        setTimeout(
          () =>
            proc.kill(
              'SIGKILL'
            ),
          timeout
        );


      proc.on(
        'error',
        error => {

          clearTimeout(
            timer
          );


          resolve({

            code: 127,

            stdout,

            stderr:
              `${stderr}\n${error.message}`,

            timedOut:
              false

          });

        }
      );


      proc.on(
        'close',
        (
          code,
          signal
        ) => {

          clearTimeout(
            timer
          );


          resolve({

            code:
              code ?? 1,

            stdout,

            stderr,

            signal,

            timedOut:
              signal ===
              'SIGKILL'

          });

        }
      );

    }
  );

}


async function ollamaRequest(
  body,
  timeoutMs = 180000
) {

  let lastError;


  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {

    const controller =
      new AbortController();


    const timer =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs
      );


    try {

      const response =
        await fetch(
          `${OLLAMA}/api/chat`,
          {

            method:
              'POST',

            signal:
              controller.signal,

            headers: {

              'Content-Type':
                'application/json'

            },

            body:
              JSON.stringify({

                ...body,

                stream:
                  false,

                keep_alive:
                  KEEP_ALIVE

              })

          }
        );


      if (
        !response.ok
      ) {

        throw new Error(
          `Ollama HTTP ${response.status}: ${await response.text()}`
        );

      }


      return await response.json();

    } catch (error) {

      lastError =
        error;


      if (
        attempt <
        MAX_RETRIES
      ) {

        await sleep(
          Math.min(
            30000,
            2500 *
            2 ** (
              attempt - 1
            )
          )
        );

      }

    } finally {

      clearTimeout(
        timer
      );

    }

  }


  throw lastError;

}


async function ollamaJson({

  model,

  system,

  user,

  schema,

  temperature = 0.2,

  numPredict = 500,

  timeoutMs = 180000

}) {

  const result =
    await ollamaRequest(
      {

        model,

        think:
          false,

        format:
          schema,

        messages: [

          {
            role:
              'system',
            content:
              system
          },

          {
            role:
              'user',
            content:
              user
          }

        ],

        options: {

          temperature,

          num_predict:
            numPredict

        }

      },

      timeoutMs

    );


  const content =
    result?.message?.content;


  if (
    !content
  ) {

    throw new Error(
      `${model} returned empty content`
    );

  }


  try {

    return JSON.parse(
      content
    );

  } catch (error) {

    throw new Error(
      `${model} returned invalid JSON: ${error.message}\n${content.slice(0, 1000)}`
    );

  }

}


function buildPlan() {

  const attack =
    randomItem(
      ATTACKS
    );


  const language =
    weightedChoice(
      LANGUAGES
    );


  const style =
    randomItem(
      STYLES
    );


  if (
    Math.random() <
    CONFUSION_RATE
  ) {

    const pair =
      randomItem(
        CONFUSION_PAIRS
      );


    const flip =
      Math.random() <
      0.5;


    return {

      domain:
        'confusion_boundary',

      concept:
        flip
          ? pair[0]
          : pair[1],

      confusionWith:
        flip
          ? pair[1]
          : pair[0],

      attack,

      language,

      style

    };

  }


  const domain =
    weightedRandomDomain();


  return {

    domain:
      domain.name,

    concept:
      randomItem(
        domain.concepts
      ),

    confusionWith:
      '',

    attack,

    language,

    style

  };

}


async function loadLearnedHints(
  limit = 12
) {

  const memory =
    await readJson(
      LEARNED_MEMORY_FILE,
      {
        proposals: []
      }
    );


  return (
    memory.proposals ||
    []
  )

    .slice(
      -limit
    )

    .map(
      p => ({

        type:
          p.proposal?.proposal_type,

        title:
          p.proposal?.title,

        aliases:
          p.proposal?.candidate_aliases,

        negative_relations:
          p.proposal?.negative_relations

      })
    );

}


async function generateCase(plan) {

  const hints =
    await loadLearnedHints();


  const system =
`
Jesteś autonomicznym red-teamerem parsera CV w projekcie CVelocity.

Tworzysz WYŁĄCZNIE syntetyczne CV i nigdy nie używasz prawdziwych danych osobowych.

Twoim celem jest znaleźć błędy parsera, a nie wygenerować ładne CV.

Buduj realistyczne mini-CV 5-18 linii, z naturalnymi nagłówkami sekcji i kontekstem zawodowym.

Zasady prawdy:

- narzędzie != kompetencja administracyjna
- ekspozycja != samodzielne doświadczenie
- kurs != doświadczenie komercyjne
- członkostwo w zespole != osobiste wykonanie zadania
- technologia powiązana != technologia równoważna
- brak dowodu nie oznacza dowodu braku
- nie wolno zawyżać seniority
- zachowaj rozróżnienie user/admin
- zachowaj rozróżnienie assisted/independent
- zachowaj rozróżnienie project/production

Przykłady granic:

Outlook != Exchange Online admin
Azure != Entra ID
Docker != Kubernetes
Excel != automatycznie BI
Salesforce user != Salesforce admin
KYC != automatycznie AML analyst
project coordination != project management
PLC exposure != PLC programming

Dla false_negative opisz prawdziwą kompetencję nieoczywistym językiem.

Dla false_positive użyj kuszących, ale niewystarczających sygnałów.

Dla negation_trap umieść jawne zaprzeczenie kompetencji obok podobnych słów.

Dla keyword_stuffing użyj słów kluczowych bez realnego dowodu wykonania pracy.

Dla section_heading_noise i ocr_noise testuj strukturę dokumentu, ale tekst nadal musi być interpretowalny.

Nie zwracaj nic poza JSON-em zgodnym ze schematem.
`;


  const user =
`
PLAN TESTU:

Domena:
${plan.domain}

Target:
${plan.concept}

Konfuzja z:
${plan.confusionWith || '(brak)'}

Typ ataku:
${plan.attack}

Język:
${plan.language}

Styl:
${plan.style}

Wygeneruj jeden trudny przypadek.

Preferuj difficulty 4-5.

Expected ma opisywać PRAWDĘ wynikającą z tekstu źródłowego dla targetu, a nie przewidywanie parsera.

Jeżeli dowód jest częściowy, wybierz PARTIAL.

Jeżeli tekst celowo nie pozwala rozstrzygnąć, wybierz AMBIGUOUS.

Ostatnie zatwierdzone hipotezy laboratorium, które możesz wykorzystać do tworzenia trudniejszych kontrprzykładów:

${JSON.stringify(hints)}
`;


  return await ollamaJson({

    model:
      GENERATOR,

    system,

    user,

    schema:
      GENERATOR_SCHEMA,

    temperature:
      0.42,

    numPredict:
      700,

    timeoutMs:
      240000

  });

}


async function critiqueCase(
  generated
) {

  const system =
`
Jesteś niezależnym audytorem datasetu CVelocity.

Generator jest podejrzany i może się mylić.

Oceniasz WYŁĄCZNIE prawdę w tekście źródłowym.

SUPPORTED:
target jest jasno potwierdzony wykonaniem, odpowiedzialnością lub jednoznaczną kompetencją.

PARTIAL:
dowód jest ograniczony, pośredni, węższy/szerszy albo tylko część kompetencji jest potwierdzona.

UNSUPPORTED:
tekst nie daje wystarczającego dowodu albo zawiera wyłącznie technologię powiązaną.

AMBIGUOUS:
rozsądny audytor nie może bezpiecznie rozstrzygnąć.

Nie nagradzaj keyword stuffingu.

Nie zakładaj umiejętności tylko dlatego, że kandydat używał produktu.

Odrzucaj banalne, sztuczne, wewnętrznie sprzeczne i nierealistyczne przypadki.

Nie zgadzaj się automatycznie z generatorem.
`;


  return await ollamaJson({

    model:
      CRITIC,

    system,

    user:
      `Przeprowadź audyt przypadku:\n${JSON.stringify(generated, null, 2)}`,

    schema:
      CRITIC_SCHEMA,

    temperature:
      0.08,

    numPredict:
      450,

    timeoutMs:
      220000

  });

}


async function runParser(
  cvText,
  caseId
) {

  const input =
    path.join(
      DIRS.tmp,
      `${caseId}.txt`
    );


  await fs.writeFile(
    input,
    cvText
  );


  try {

    if (
      !fsSync.existsSync(
        TSX_BIN
      )
    ) {

      throw new Error(
        `tsx not found at ${TSX_BIN}`
      );

    }


    const result =
      await runCommand(
        TSX_BIN,
        [
          PARSER_PROBE,
          input
        ],
        {
          timeout:
            120000
        }
      );


    if (
      result.code !==
      0
    ) {

      throw new Error(
        `Parser probe exit=${result.code}\n${result.stderr}\n${result.stdout}`
      );

    }


    const marker =
      '__CVELOCITY_JSON__';


    const line =
      result.stdout

        .split(
          /\r?\n/
        )

        .reverse()

        .find(
          value =>
            value.startsWith(
              marker
            )
        );


    if (
      !line
    ) {

      throw new Error(
        `Parser probe JSON marker missing. Output: ${result.stdout.slice(-2000)}`
      );

    }


    return JSON.parse(
      line.slice(
        marker.length
      )
    );

  } finally {

    await fs.unlink(
      input
    ).catch(
      () => {}
    );

  }

}


function compactParserResult(
  parsed
) {

  return {

    personalInfo:
      parsed?.personalInfo ||
      {},

    hardSkills:
      parsed?.hardSkills ||
      [],

    softSkills:
      parsed?.softSkills ||
      [],

    toolsAndTech:
      parsed?.toolsAndTech ||
      [],

    certifications:
      parsed?.certifications ||
      [],

    history:
      parsed?.history ||
      [],

    education:
      parsed?.education ||
      [],

    languages:
      parsed?.languages ||
      [],

    projects:
      parsed?.projects ||
      [],

    detectedFormat:
      parsed?.detectedFormat,

    warnings:
      parsed?.warnings ||
      []

  };

}


function deterministicParserSignals(
  target,
  parsed
) {

  const serialized =
    normalizeText(
      JSON.stringify(
        compactParserResult(
          parsed
        )
      )
    );


  const normalizedTarget =
    normalizeText(
      target
    );


  const tokens =
    normalizedTarget

      .split(' ')

      .filter(
        token =>
          token.length >= 3
      );


  const tokenHits =
    tokens.filter(
      token =>
        serialized.includes(
          token
        )
    );


  return {

    literal_target_seen:

      normalizedTarget.length >
      1 &&

      serialized.includes(
        normalizedTarget
      ),

    target_tokens:
      tokens,

    token_hits:
      tokenHits,

    token_coverage:

      tokens.length

        ? Number(
            (
              tokenHits.length /
              tokens.length
            ).toFixed(3)
          )

        : 0

  };

}


async function judgeParser(
  target,
  parsed,
  deterministic
) {

  const system =
`
Jesteś sędzią wyników RZECZYWISTEGO parsera CVelocity.

Dostajesz tylko strukturę WYEKSTRAHOWANĄ przez parser, nie oryginalne CV.

Masz ocenić, jak mocno WYJŚCIE PARSERA potwierdza target.

SUPPORTED:
parser wyekstrahował target lub jednoznaczny kanoniczny odpowiednik jako kompetencję/doświadczenie.

PARTIAL:
parser zachował część potrzebnego dowodu, ale nie pełną kompetencję.

UNSUPPORTED:
w wyjściu parsera nie ma wystarczającego dowodu targetu.

AMBIGUOUS:
struktura parsera jest zbyt niejasna, by bezpiecznie ocenić.

Nie uzupełniaj braków własną wiedzą.

Nie wolno Ci wracać do treści źródłowej, bo jej nie dostajesz.
`;


  return await ollamaJson({

    model:
      CRITIC,

    system,

    user:
`TARGET:
${target}

DETERMINISTYCZNE SYGNAŁY:
${JSON.stringify(deterministic, null, 2)}

WYJŚCIE PARSERA:
${JSON.stringify(compactParserResult(parsed), null, 2)}
`,

    schema:
      PARSER_JUDGE_SCHEMA,

    temperature:
      0.05,

    numPredict:
      350,

    timeoutMs:
      220000

  });

}


function classifyDisagreement(
  expected,
  actual
) {

  if (
    expected ===
    actual
  ) {

    return {

      match:
        true,

      type:
        'MATCH',

      severity:
        'none'

    };

  }


  if (
    expected ===
      'SUPPORTED' &&
    actual ===
      'UNSUPPORTED'
  ) {

    return {

      match:
        false,

      type:
        'FALSE_NEGATIVE',

      severity:
        'high'

    };

  }


  if (
    expected ===
      'SUPPORTED' &&
    actual ===
      'AMBIGUOUS'
  ) {

    return {

      match:
        false,

      type:
        'LOST_EVIDENCE',

      severity:
        'high'

    };

  }


  if (
    expected ===
      'SUPPORTED' &&
    actual ===
      'PARTIAL'
  ) {

    return {

      match:
        false,

      type:
        'UNDER_RECOGNITION',

      severity:
        'medium'

    };

  }


  if (
    expected ===
      'UNSUPPORTED' &&
    actual ===
      'SUPPORTED'
  ) {

    return {

      match:
        false,

      type:
        'FALSE_POSITIVE',

      severity:
        'high'

    };

  }


  if (
    expected ===
      'UNSUPPORTED' &&
    actual ===
      'PARTIAL'
  ) {

    return {

      match:
        false,

      type:
        'OVER_INFERENCE',

      severity:
        'medium'

    };

  }


  if (
    expected ===
      'PARTIAL' &&
    actual ===
      'SUPPORTED'
  ) {

    return {

      match:
        false,

      type:
        'OVERCLAIM',

      severity:
        'high'

    };

  }


  if (
    expected ===
      'PARTIAL' &&
    actual ===
      'UNSUPPORTED'
  ) {

    return {

      match:
        false,

      type:
        'PARTIAL_MISSED',

      severity:
        'medium'

    };

  }


  if (
    expected ===
      'AMBIGUOUS' &&
    actual ===
      'SUPPORTED'
  ) {

    return {

      match:
        false,

      type:
        'AMBIGUITY_OVERCLAIM',

      severity:
        'high'

    };

  }


  if (
    expected ===
      'AMBIGUOUS' &&
    actual ===
      'UNSUPPORTED'
  ) {

    return {

      match:
        false,

      type:
        'AMBIGUITY_COLLAPSED',

      severity:
        'low'

    };

  }


  return {

    match:
      false,

    type:
      'CLASSIFICATION_MISMATCH',

    severity:
      'medium'

  };

}


async function saveRejected(
  generated,
  critique,
  state
) {

  const id =
    makeId(
      'rej-'
    );


  await writeJson(

    path.join(
      DIRS.rejected,
      `${id}.json`
    ),

    {

      id,

      generated_at:
        new Date().toISOString(),

      generator:
        GENERATOR,

      critic:
        CRITIC,

      generated,

      critique

    }

  );


  state.rejected++;

}


async function processCase(
  state
) {

  const plan =
    buildPlan();


  await log(
    `ITERATION ${state.iteration} domain="${plan.domain}" target="${plan.concept}" attack="${plan.attack}" lang=${plan.language} style=${plan.style}`
  );


  await heartbeat(
    state,
    'generate'
  );


  const generated =
    await generateCase(
      plan
    );


  state.generated++;


  await heartbeat(
    state,
    'critic'
  );


  const critique =
    await critiqueCase(
      generated
    );


  if (

    !critique.valid_case ||

    !critique.useful_for_training ||

    critique.leakage_or_unrealism ||

    critique.confidence <
      MIN_CRITIC_CONFIDENCE

  ) {

    await saveRejected(
      generated,
      critique,
      state
    );


    await log(
      `REJECTED critic_conf=${Number(critique.confidence).toFixed(2)} reason=${String(critique.reason).slice(0, 180)}`
    );


    return null;

  }


  const expected =
    critique.corrected_expected;


  const dedupeKey = {

    target:
      normalizeText(
        generated.target_concept
      ),

    text:
      normalizeText(
        generated.cv_text
      ),

    expected

  };


  const hash =
    fingerprint(
      dedupeKey
    ).slice(
      0,
      20
    );


  const corpusFile =
    path.join(
      DIRS.corpus,
      `${hash}.json`
    );


  if (
    fsSync.existsSync(
      corpusFile
    )
  ) {

    state.duplicates++;


    await log(
      `DUPLICATE ${hash}`
    );


    return null;

  }


  await heartbeat(
    state,
    'parser'
  );


  let parsed;


  try {

    parsed =
      await runParser(
        generated.cv_text,
        hash
      );


    state.parserRuns++;

  } catch (error) {

    state.parserErrors++;


    await writeJson(

      path.join(
        DIRS.parserErrors,
        `${hash}.json`
      ),

      {

        id:
          hash,

        generated,

        critique,

        error:
          error.stack ||
          error.message,

        at:
          new Date().toISOString()

      }

    );


    throw error;

  }


  const deterministic =
    deterministicParserSignals(
      generated.target_concept,
      parsed
    );


  await heartbeat(
    state,
    'parser_judge'
  );


  const parserJudge =
    await judgeParser(
      generated.target_concept,
      parsed,
      deterministic
    );


  const actual =
    parserJudge.actual;


  const disagreement =
    classifyDisagreement(
      expected,
      actual
    );


  const record = {

    id:
      hash,

    generated_at:
      new Date().toISOString(),

    models: {

      generator:
        GENERATOR,

      critic:
        CRITIC,

      parserJudge:
        CRITIC

    },

    plan,

    generated,

    critique,

    source_truth:
      expected,

    parser_actual:
      actual,

    parser_judge:
      parserJudge,

    deterministic,

    parser_output:
      compactParserResult(
        parsed
      ),

    disagreement

  };


  await writeJson(
    corpusFile,
    record
  );


  state.accepted++;


  bump(
    state.coverage.domains,
    plan.domain
  );


  bump(
    state.coverage.attacks,
    generated.attack_type ||
      plan.attack
  );


  bump(
    state.coverage.expected,
    expected
  );


  bump(
    state.coverage.actual,
    actual
  );


  if (

    disagreement.match ||

    parserJudge.confidence <
      MIN_JUDGE_CONFIDENCE

  ) {

    if (
      disagreement.match
    ) {

      state.parserMatches++;

    }


    await log(
      `ACCEPTED ${hash} expected=${expected} actual=${actual} verdict=${disagreement.type} judge_conf=${Number(parserJudge.confidence).toFixed(2)}`
    );


    return record;

  }


  state.parserDisagreements++;


  bump(
    state.coverage.failureTypes,
    disagreement.type
  );


  if (
    disagreement.severity ===
    'high'
  ) {

    state.highSeverityFailures++;

  }


  await writeJson(

    path.join(
      DIRS.failures,
      `${hash}.json`
    ),

    record

  );


  await log(
    `FAILURE ${hash} ${disagreement.type} severity=${disagreement.severity} expected=${expected} actual=${actual}`
  );


  return record;

}


async function listJson(
  dir
) {

  try {

    return (
      await fs.readdir(
        dir
      )
    ).filter(
      file =>
        file.endsWith(
          '.json'
        )
    );

  } catch {

    return [];

  }

}


async function loadRecentFailures(
  limit = 6
) {

  const files =
    await listJson(
      DIRS.failures
    );


  const entries = [];


  for (
    const file
    of files
  ) {

    try {

      const full =
        path.join(
          DIRS.failures,
          file
        );


      const stat =
        await fs.stat(
          full
        );


      entries.push({

        file,

        mtime:
          stat.mtimeMs

      });

    } catch {}

  }


  entries.sort(
    (a, b) =>
      b.mtime -
      a.mtime
  );


  const selected = [];


  for (
    const entry
    of entries.slice(
      0,
      limit
    )
  ) {

    selected.push(

      await readJson(

        path.join(
          DIRS.failures,
          entry.file
        ),

        null

      )

    );

  }


  return selected.filter(
    Boolean
  );

}


async function proposeLearning(
  failures
) {

  const system =
`
Jesteś inżynierem parsera CVelocity.

Analizujesz potwierdzone rozbieżności pomiędzy prawdą źródłową a realnym wyjściem parsera.

Nie wolno Ci modyfikować repozytorium ani proponować wielkiego refaktoru.

Preferuj najmniejszą możliwą poprawkę:

- alias
- relację negatywną
- granicę kompetencji
- wzorzec nagłówka
- normalizację
- regułę ekstrakcji

Projekt ma realny parser src/lib/cvUniversalParser.ts oraz warstwę semantic-work-graph z JargonMapperem.

Nie zakładaj, że każdą poprawkę trzeba wkleić do parsera.

Jeżeli problem jest leksykalny, preferuj dane/lexicon.

Jeżeli strukturalny, wskaż parser.

Propozycja ma być konserwatywna i minimalizować false positives.

Nie generuj patcha wykonywalnego.

Zwróć wyłącznie ustrukturyzowaną hipotezę i test regresyjny.
`;


  return await ollamaJson({

    model:
      CODER,

    system,

    user:
      `Rozbieżności:\n${JSON.stringify(failures, null, 2)}`,

    schema:
      PROPOSAL_SCHEMA,

    temperature:
      0.08,

    numPredict:
      1000,

    timeoutMs:
      300000

  });

}


async function reviewProposal(
  proposal,
  failures
) {

  const system =
`
Jesteś drugim audytorem zmian parsera CVelocity.

Masz chronić parser przed nadmiernym dopasowaniem do kilku syntetycznych przykładów.

Shadow-accept oznacza tylko:

"warto zachować jako zweryfikowaną hipotezę do późniejszego wdrożenia".

Nie oznacza automatycznej zmiany kodu.

Odrzuć propozycję, jeśli:

- zwiększa ryzyko false positive
- miesza pojęcia powiązane z równoważnymi
- ma zbyt mało dowodów
- jest zbyt szeroka
- zmniejsza truth floor
`;


  return await ollamaJson({

    model:
      CRITIC,

    system,

    user:
`PROPOZYCJA:
${JSON.stringify(proposal, null, 2)}

DOWODY:
${JSON.stringify(failures, null, 2)}
`,

    schema:
      PROPOSAL_REVIEW_SCHEMA,

    temperature:
      0.05,

    numPredict:
      400,

    timeoutMs:
      220000

  });

}


async function appendLearnedMemory(
  entry
) {

  const memory =
    await readJson(

      LEARNED_MEMORY_FILE,

      {

        version: 1,

        proposals: []

      }

    );


  memory.proposals =
    Array.isArray(
      memory.proposals
    )

      ? memory.proposals

      : [];


  memory.proposals.push(
    entry
  );


  if (
    memory.proposals.length >
    500
  ) {

    memory.proposals =
      memory.proposals.slice(
        -500
      );

  }


  memory.updated_at =
    new Date().toISOString();


  await writeJson(
    LEARNED_MEMORY_FILE,
    memory
  );

}


async function maybeGenerateProposal(
  state
) {

  const failures =
    await loadRecentFailures(
      6
    );


  if (
    failures.length <
    PROPOSAL_FAILURE_BATCH
  ) {

    return;

  }


  if (
    state.parserDisagreements -
      state.lastProposalFailureCount <
    PROPOSAL_FAILURE_BATCH
  ) {

    return;

  }


  await heartbeat(
    state,
    'proposal'
  );


  const proposal =
    await proposeLearning(
      failures
    );


  const id =
    makeId(
      'proposal-'
    );


  const proposalRecord = {

    id,

    generated_at:
      new Date().toISOString(),

    coder:
      CODER,

    proposal,

    evidence_ids:
      failures.map(
        failure =>
          failure.id
      )

  };


  await writeJson(

    path.join(
      DIRS.proposals,
      `${id}.json`
    ),

    proposalRecord

  );


  state.proposals++;


  await heartbeat(
    state,
    'proposal_review'
  );


  const review =
    await reviewProposal(
      proposal,
      failures
    );


  proposalRecord.review =
    review;


  await writeJson(

    path.join(
      DIRS.proposals,
      `${id}.json`
    ),

    proposalRecord

  );


  if (

    review.valid &&

    review.action ===
      'shadow_accept' &&

    review.confidence >=
      0.82 &&

    review.risk !==
      'high'

  ) {

    const validated = {

      ...proposalRecord,

      validated_at:
        new Date().toISOString()

    };


    await writeJson(

      path.join(
        DIRS.validated,
        `${id}.json`
      ),

      validated

    );


    await appendLearnedMemory(
      validated
    );


    await fs.appendFile(

      path.join(
        DIRS.generatedTests,
        'regression-candidates.ndjson'
      ),

      `${JSON.stringify({

        id,

        test:
          proposal.regression_test,

        source_failure_ids:
          proposal.source_failure_ids

      })}\n`

    );


    state.validatedProposals++;


    await log(
      `LEARNED_SHADOW ${id} type=${proposal.proposal_type} confidence=${Number(review.confidence).toFixed(2)}`
    );

  } else {

    await log(
      `PROPOSAL_NOT_PROMOTED ${id} action=${review.action} risk=${review.risk} confidence=${Number(review.confidence).toFixed(2)}`
    );

  }


  state.lastProposalFailureCount =
    state.parserDisagreements;

}


async function runFocusedTests(
  state
) {

  const files = [

    'src/lib/__tests__/cv_parser.test.ts',

    'src/lib/__tests__/cv_parser_adversarial.test.ts',

    'src/lib/__tests__/cv_parser_adversarial_20.test.ts',

    'src/lib/__tests__/cv_parser_valid_20.test.ts',

    'src/lib/__tests__/cv_parser_stress.test.ts'

  ].filter(
    file =>
      fsSync.existsSync(
        path.join(
          ROOT,
          file
        )
      )
  );


  if (

    !files.length ||

    !fsSync.existsSync(
      VITEST_BIN
    )

  ) {

    await log(
      'FOCUSED TESTS skipped: vitest or parser tests not found'
    );


    return;

  }


  await heartbeat(
    state,
    'focused_tests'
  );


  const result =
    await runCommand(

      VITEST_BIN,

      [
        'run',
        ...files
      ],

      {
        timeout:
          900000
      }

    );


  state.focusedTestRuns++;


  if (
    result.code !==
    0
  ) {

    state.focusedTestFailures++;

  }


  await fs.writeFile(

    path.join(
      DIRS.logs,
      `focused-tests-${Date.now()}-${result.code === 0 ? 'PASS' : 'FAIL'}.log`
    ),

    `${result.stdout}\n${result.stderr}`

  );


  await log(
    `FOCUSED TESTS exit=${result.code}`
  );

}


async function runFullTests(
  state
) {

  await heartbeat(
    state,
    'full_tests'
  );


  const result =
    await runCommand(

      'npm',

      [
        'test'
      ],

      {
        timeout:
          1200000
      }

    );


  state.fullTestRuns++;


  if (
    result.code !==
    0
  ) {

    state.fullTestFailures++;

  }


  await fs.writeFile(

    path.join(
      DIRS.logs,
      `full-tests-${Date.now()}-${result.code === 0 ? 'PASS' : 'FAIL'}.log`
    ),

    `${result.stdout}\n${result.stderr}`

  );


  await log(
    `FULL TESTS exit=${result.code}`
  );

}


function topEntries(
  map,
  limit = 12
) {

  return Object

    .entries(
      map || {}
    )

    .sort(
      (a, b) =>
        b[1] -
        a[1]
    )

    .slice(
      0,
      limit
    );

}


async function createReport(
  state
) {

  const corpusCount =
    (
      await listJson(
        DIRS.corpus
      )
    ).length;


  const failureCount =
    (
      await listJson(
        DIRS.failures
      )
    ).length;


  const rejectedCount =
    (
      await listJson(
        DIRS.rejected
      )
    ).length;


  const proposalCount =
    (
      await listJson(
        DIRS.proposals
      )
    ).length;


  const validatedCount =
    (
      await listJson(
        DIRS.validated
      )
    ).length;


  const accuracy =

    state.parserMatches +
      state.parserDisagreements >
    0

      ? state.parserMatches /
        (
          state.parserMatches +
          state.parserDisagreements
        )

      : 0;


  const lines = [

    '# CVelocity Autonomous Moon Lab',

    '',

    `Generated: ${new Date().toISOString()}`,

    `Started: ${state.startedAt}`,

    '',

    '## Throughput',

    `- iterations: ${state.iteration}`,

    `- generated: ${state.generated}`,

    `- accepted corpus: ${corpusCount}`,

    `- rejected by critic: ${rejectedCount}`,

    `- duplicates: ${state.duplicates}`,

    '',

    '## Real parser',

    `- parser runs: ${state.parserRuns}`,

    `- parser errors: ${state.parserErrors}`,

    `- agreements: ${state.parserMatches}`,

    `- disagreements: ${failureCount}`,

    `- high severity failures: ${state.highSeverityFailures}`,

    `- agreement rate: ${(accuracy * 100).toFixed(1)}%`,

    '',

    '## Learning',

    `- proposals: ${proposalCount}`,

    `- validated shadow proposals: ${validatedCount}`,

    '- production source auto-edits: 0',

    '',

    '## Tests',

    `- focused runs/failures: ${state.focusedTestRuns}/${state.focusedTestFailures}`,

    `- full runs/failures: ${state.fullTestRuns}/${state.fullTestFailures}`,

    '',

    '## Top domains',

    ...topEntries(
      state.coverage.domains
    ).map(
      ([key, value]) =>
        `- ${key}: ${value}`
    ),

    '',

    '## Top attacks',

    ...topEntries(
      state.coverage.attacks
    ).map(
      ([key, value]) =>
        `- ${key}: ${value}`
    ),

    '',

    '## Failure types',

    ...topEntries(
      state.coverage.failureTypes,
      20
    ).map(
      ([key, value]) =>
        `- ${key}: ${value}`
    ),

    '',

    '## Safety',

    '- generator cannot edit source code',

    '- coder produces structured hypotheses only',

    '- validated proposals live in .cvelocity-lab',

    '- no automatic commit, push or merge',

    ''

  ];


  const markdown =
    lines.join(
      '\n'
    );


  const timestamped =
    path.join(
      DIRS.reports,
      `report-${Date.now()}.md`
    );


  await fs.writeFile(
    timestamped,
    markdown
  );


  await fs.writeFile(

    path.join(
      DIRS.reports,
      'latest.md'
    ),

    markdown

  );


  await writeJson(

    path.join(
      DIRS.reports,
      'latest.json'
    ),

    {

      generated_at:
        new Date().toISOString(),

      state,

      counts: {

        corpusCount,

        failureCount,

        rejectedCount,

        proposalCount,

        validatedCount

      },

      agreementRate:
        accuracy

    }

  );


  await log(
    `REPORT corpus=${corpusCount} failures=${failureCount} validated=${validatedCount} agreement=${(accuracy * 100).toFixed(1)}%`
  );

}


async function checkDiskSpace() {

  const result =
    await runCommand(
      'df',
      [
        '-Pk',
        ROOT
      ],
      {
        timeout:
          10000
      }
    );


  if (
    result.code !==
    0
  ) {

    return true;

  }


  const lines =
    result.stdout

      .trim()

      .split(
        /\r?\n/
      );


  const row =
    lines
      .at(-1)
      ?.trim()
      .split(
        /\s+/
      );


  const availableKb =
    Number(
      row?.[3]
    );


  if (
    !Number.isFinite(
      availableKb
    )
  ) {

    return true;

  }


  const availableMb =
    availableKb /
    1024;


  if (
    availableMb <
    MIN_FREE_DISK_MB
  ) {

    await log(
      `DISK GUARD low_space=${availableMb.toFixed(0)}MB minimum=${MIN_FREE_DISK_MB}MB; sleeping 30 min`
    );


    return false;

  }


  return true;

}


async function main() {

  await init();


  let state =
    normalizeState(
      await readJson(
        STATE_FILE,
        null
      )
    );


  await log(
    '================================'
  );


  await log(
    'CVelocity Autonomous Moon Lab START'
  );


  await log(
    `PID=${process.pid}`
  );


  await log(
    `Generator=${GENERATOR}`
  );


  await log(
    `Critic=${CRITIC}`
  );


  await log(
    `Coder=${CODER}`
  );


  await log(
    `Ollama=${OLLAMA}`
  );


  await log(
    'Mode=real-parser + critic + shadow-learning'
  );


  while (
    !stopping
  ) {

    try {

      state.iteration++;


      await heartbeat(
        state,
        'iteration_start'
      );


      if (
        state.iteration %
          50 ===
        0
      ) {

        const diskOk =
          await checkDiskSpace();


        if (
          !diskOk
        ) {

          await saveState(
            state
          );


          await sleep(
            30 *
            60 *
            1000
          );


          continue;

        }

      }


      await processCase(
        state
      );


      state.consecutiveErrors =
        0;


      if (

        TEST_EVERY >
          0 &&

        state.iteration %
          TEST_EVERY ===
          0

      ) {

        await runFocusedTests(
          state
        );

      }


      if (

        FULL_TEST_EVERY >
          0 &&

        state.iteration %
          FULL_TEST_EVERY ===
          0

      ) {

        await runFullTests(
          state
        );

      }


      await maybeGenerateProposal(
        state
      );


      if (

        REPORT_EVERY >
          0 &&

        state.iteration %
          REPORT_EVERY ===
          0

      ) {

        await createReport(
          state
        );

      }


      await saveState(
        state
      );


      await heartbeat(
        state,
        'idle'
      );


      await rotateLogIfNeeded();


      if (
        !stopping
      ) {

        await sleep(
          DELAY_MS
        );

      }

    } catch (error) {

      state.modelErrors++;


      state.consecutiveErrors =
        (
          state.consecutiveErrors ||
          0
        ) + 1;


      await saveState(
        state
      ).catch(
        () => {}
      );


      await heartbeat(
        state,
        'error'
      ).catch(
        () => {}
      );


      await log(
        `ITERATION ERROR #${state.consecutiveErrors}: ${error.stack || error.message}`
      );


      const backoff =
        Math.min(

          5 *
          60 *
          1000,

          15000 *
          2 ** Math.min(
            5,
            state.consecutiveErrors - 1
          )

        );


      if (
        !stopping
      ) {

        await sleep(
          backoff
        );

      }

    }

  }


  await createReport(
    state
  ).catch(
    () => {}
  );


  await saveState(
    state
  ).catch(
    () => {}
  );


  await heartbeat(
    state,
    'stopped'
  ).catch(
    () => {}
  );


  await log(
    'CVelocity Autonomous Moon Lab STOP'
  );

}


async function requestStop(
  signal
) {

  if (
    stopping
  ) {

    return;

  }


  stopping =
    true;


  await log(
    `${signal} received; finishing current step and shutting down cleanly`
  ).catch(
    () => {}
  );

}


process.on(
  'SIGTERM',
  () => {
    void requestStop(
      'SIGTERM'
    );
  }
);


process.on(
  'SIGINT',
  () => {
    void requestStop(
      'SIGINT'
    );
  }
);


process.on(
  'exit',
  cleanupLockSync
);


main()

  .catch(
    async error => {

      await log(
        `FATAL ${error.stack || error.message}`
      ).catch(
        () => {}
      );


      process.exitCode =
        1;

    }
  )

  .finally(
    () =>
      cleanupLockSync()
  );
