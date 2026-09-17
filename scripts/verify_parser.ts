import { parseTextToMasterVault } from '../src/lib/cvUniversalParser';
import fs from 'fs';

const PDF_PATH = process.argv[2];
const TRUTH_PATH = process.argv[3];

if (!PDF_PATH || !TRUTH_PATH) {
  console.log('Użycie: npx tsx scripts/verify_parser.ts <pdf> <mastervault.json>');
  process.exit(2);
}

const truth = JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf-8'));
const text = fs.readFileSync(PDF_PATH, 'utf-8');

const parsed = parseTextToMasterVault(text, 'TXT');

const errors: string[] = [];
const notes: string[] = [];

console.log(`Porównanie parsera vs prawda: ${truth.name}`);
console.log(`PDF: ${PDF_PATH}`);
console.log();

// --- Personal info ---
if (parsed.personalInfo.fullName !== truth.name) {
  errors.push(`  NAME: parsed="${parsed.personalInfo.fullName}" != truth="${truth.name}"`);
} else {
  console.log(`[OK] Name: ${parsed.personalInfo.fullName}`);
}

if (parsed.personalInfo.email !== truth.contact?.email) {
  errors.push(`  EMAIL: parsed="${parsed.personalInfo.email}" != truth="${truth.contact?.email}"`);
} else {
  console.log(`[OK] Email: ${parsed.personalInfo.email}`);
}

if (parsed.personalInfo.phone !== truth.contact?.phone) {
  errors.push(`  PHONE: parsed="${parsed.personalInfo.phone}" != truth="${truth.contact?.phone}"`);
} else {
  console.log(`[OK] Phone: ${parsed.personalInfo.phone}`);
}

if (parsed.personalInfo.location !== truth.contact?.city) {
  errors.push(`  LOCATION: parsed="${parsed.personalInfo.location}" != truth="${truth.contact?.city}"`);
} else {
  console.log(`[OK] Location: ${parsed.personalInfo.location}`);
}

if (parsed.personalInfo.title !== truth.title) {
  errors.push(`  TITLE: parsed="${parsed.personalInfo.title}" != truth="${truth.title}"`);
} else {
  console.log(`[OK] Title: ${parsed.personalInfo.title}`);
}

// --- Skills ---
const truthSkillLabels = truth.skills.map((s: any) => String(s.label || s));
const allParsedSkills = [...parsed.hardSkills, ...parsed.toolsAndTech, ...parsed.softSkills];
const truthSkillSet = new Set<string>(truthSkillLabels.map((s: string) => s.toLowerCase()));
const parsedSkillSet = new Set<string>(allParsedSkills.map((s: string) => s.toLowerCase()));

const missingFromParsed = [...truthSkillSet].filter((s: string) => !parsedSkillSet.has(s));
const extraInParsed = [...parsedSkillSet].filter((s: string) => !truthSkillSet.has(s));

if (missingFromParsed.length === 0 && extraInParsed.length === 0) {
  console.log(`[OK] Skills: wszystkie ${truthSkillLabels.length} znalezione`);
} else {
  if (missingFromParsed.length > 0) errors.push(`  SKILLS MISSING: ${missingFromParsed.join(', ')}`);
  if (extraInParsed.length > 0) notes.push(`  SKILLS EXTRA: ${extraInParsed.join(', ')}`);
}

// --- History ---
const truthExp = truth.experience || [];
if (parsed.history.length !== truthExp.length) {
  errors.push(`  EXPERIENCE COUNT: parsed=${parsed.history.length} != truth=${truthExp.length}`);
}

const truthRoles = truthExp.map((e: any) => e.role);
const parsedRoles = parsed.history.map((h: any) => h.role);
for (const tr of truthRoles) {
  const found = parsedRoles.some((pr: string) => pr.includes(tr) || tr.includes(pr));
  if (!found) errors.push(`  ROLE MISSING: '${tr}' nie znaleziony w parsed`);
}

const truthCompanies = truthExp.map((e: any) => e.company);
const parsedCompanies = parsed.history.map((h: any) => h.company);
for (const tc of truthCompanies) {
  const found = parsedCompanies.some((pc: string) => pc.includes(tc) || tc.includes(pc));
  if (!found) errors.push(`  COMPANY MISSING: '${tc}' nie znaleziony w parsed`);
}

// --- Education ---
const truthEdu = truth.education || [];
if (parsed.education.length !== truthEdu.length) {
  errors.push(`  EDUCATION COUNT: parsed=${parsed.education.length} != truth=${truthEdu.length}`);
}

// --- Certifications ---
const truthCerts = truth.certifications || [];
const truthCertNames = truthCerts.map((c: any) => c.name);
const parsedCertNames = parsed.certifications.map((c: any) => c.name);
for (const tc of truthCertNames) {
  if (!parsedCertNames.some((pn: string) => pn.includes(tc) || tc.includes(pn))) {
    errors.push(`  CERT MISSING: '${tc}' nie znaleziony`);
  }
}

// --- Licenses ---
const truthLicenses = truth.licenses || [];
const parsedLicenses = (parsed.personalInfo as any)?.licenses || [];
for (const tl of truthLicenses) {
  if (!parsedLicenses.some((pl: string) => pl.includes(tl) || tl.includes(pl))) {
    notes.push(`  LICENSE: '${tl}' nie znaleziony w parsed`);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors.length === 0) {
  console.log('WYNIK: PASS — parser odczytuje dane zgodne z prawdą');
} else {
  console.log(`WYNIK: FAIL — ${errors.length} błędów`);
  for (const e of errors) console.log(`  [X] ${e}`);
}
if (notes.length > 0) {
  console.log('\n[Uwagi]:');
  for (const n of notes) console.log(`  [i] ${n}`);
}
console.log('='.repeat(50));

// Print parsed structure for debugging
console.log('\n--- PARSED STRUCTURE ---');
console.log(`Name: ${parsed.personalInfo.fullName}`);
console.log(`Title: ${parsed.personalInfo.title}`);
console.log(`Email: ${parsed.personalInfo.email}`);
console.log(`Phone: ${parsed.personalInfo.phone}`);
console.log(`Location: ${parsed.personalInfo.location}`);
console.log(`HardSkills (${parsed.hardSkills.length}): ${parsed.hardSkills.slice(0,10).join(', ')}`);
console.log(`Tools (${parsed.toolsAndTech.length}): ${parsed.toolsAndTech.slice(0,10).join(', ')}`);
console.log(`SoftSkills (${parsed.softSkills.length}): ${parsed.softSkills.slice(0,5).join(', ')}`);
console.log(`Experience (${parsed.history.length}):`);
for (const h of parsed.history) {
  console.log(`  ${h.company} | ${h.role} | ${h.startDate} - ${h.endDate}`);
}
console.log(`Education (${parsed.education.length}):`);
for (const e of parsed.education) {
  console.log(`  ${e.institution} | ${e.degree}`);
}
console.log(`Certifications (${parsed.certifications.length}):`);
for (const c of parsed.certifications) {
  console.log(`  ${c.name}`);
}

process.exit(errors.length > 0 ? 1 : 0);
