import { describe, it, expect } from 'vitest';
import { auditKnockouts, findDanglingLicenseIds, KNOCKOUT_RULES } from '../knockouts';
import { scoreCanonicalAts } from '../canonicalAts';
import { ALL_LICENSES } from '../../data/licenses';
import { createEmptyVault } from '../sampleVault';
import { MasterVault } from '../../types';

/** Profil z zaznaczonymi uprawnieniami i opcjonalnym tekstem w doświadczeniu. */
function vaultWith(licenses: string[], highlightText = ''): MasterVault {
  const vault = createEmptyVault('Jan Kowalski');
  vault.profiler.licenses = licenses;

  if (highlightText) {
    vault.history = [
      {
        id: 'exp-1',
        company: 'Zakład',
        role: 'Pracownik',
        location: 'Kraków',
        startDate: '01.2020',
        endDate: 'Obecnie',
        isCurrent: true,
        highlights: [
          {
            id: 'h-1',
            text: highlightText,
            action: '',
            target: '',
            tool: '',
            metric: '',
            keywords: [],
          },
        ],
      },
    ];
  }

  return vault;
}

describe('Spójność katalogu uprawnień', () => {
  it('każda reguła wskazuje istniejące uprawnienie', () => {
    // Rozjazd tych dwóch list byłby cichy i objawiłby się użytkownikowi jako
    // „nie masz uprawnienia, które przed chwilą zaznaczyłeś".
    expect(findDanglingLicenseIds()).toEqual([]);
  });

  it('katalog nie ma zduplikowanych identyfikatorów', () => {
    const ids = ALL_LICENSES.map((license) => license.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reguły nie mają zduplikowanych identyfikatorów', () => {
    const ids = KNOCKOUT_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('każde uprawnienie dostępne w profilu ma regułę sprawdzającą ofertę', () => {
    const checkedLicenseIds = new Set(KNOCKOUT_RULES.flatMap((rule) => rule.satisfiedByLicenseIds));
    const unchecked = ALL_LICENSES.filter((license) => !checkedLicenseIds.has(license.id));

    expect(unchecked.map((license) => license.id)).toEqual([]);
  });
});

describe('Prawo jazdy i certyfikaty IT', () => {
  it.each([
    ['prawo jazdy A', 'Wymagane prawo jazdy kat. A.', 'Prawo jazdy kategorii A', 'Prawo jazdy kat. A1', 'license_a'],
    ['certyfikat Azure', 'Mile widziany certyfikat Azure.', 'Certyfikat Microsoft Azure', 'Praktyczna znajomość Azure bez certyfikatu', 'cloud_cert_azure'],
    ['certyfikat AWS', 'Mile widziany certyfikat AWS.', 'AWS Certified Solutions Architect', 'Certyfikat Microsoft Azure', 'cloud_cert_aws'],
    ['Scrum Master', 'Wymagany certyfikat PSM I.', 'PSM I — Scrum.org', 'SM I i doświadczenie w agile', 'scrum_master'],
    ['Cisco CCNA', 'Mile widziane CCNA.', 'Cisco CCNA', 'Cisco CCNP', 'cisco_ccna'],
  ])('%s: prawidłowe potwierdzenie działa, a podobny zapis go nie zastępuje', (_name, jd, evidence, unrelated, ruleId) => {
    const positive = auditKnockouts(jd, vaultWith([], evidence)).findings.find((finding) => finding.ruleId === ruleId);
    const negative = auditKnockouts(jd, vaultWith([], unrelated)).findings.find((finding) => finding.ruleId === ruleId);

    expect(positive?.satisfied).toBe(true);
    expect(positive?.matchedVia).toBe('text');
    expect(negative?.satisfied).toBe(false);
    expect(negative?.matchedVia).toBeNull();
  });

  it('certyfikat zapisany w katalogu profilu spełnia tylko właściwe wymaganie', () => {
    const cloud = auditKnockouts('Wymagany certyfikat AWS.', vaultWith(['cloud_cert_aws']));
    const ccna = auditKnockouts('Wymagane CCNA.', vaultWith(['cloud_cert']));

    expect(cloud.findings.find((finding) => finding.ruleId === 'cloud_cert_aws')?.matchedVia).toBe('license');
    expect(ccna.findings.find((finding) => finding.ruleId === 'cisco_ccna')?.satisfied).toBe(false);
  });

  it('nieokreślony certyfikat chmurowy nie potwierdza dostawcy z ogłoszenia', () => {
    const report = auditKnockouts('Wymagany certyfikat AWS.', vaultWith(['cloud_cert']));

    expect(report.findings.find((finding) => finding.ruleId === 'cloud_cert_aws')?.satisfied).toBe(false);
  });

  it.each([
    ['cloud_cert_aws', 'Wymagany certyfikat AWS.', 'cloud_cert_azure'],
    ['cloud_cert_azure', 'Wymagany certyfikat Azure.', 'cloud_cert_gcp'],
    ['cloud_cert_gcp', 'Wymagany certyfikat Google Cloud.', 'cloud_cert_aws'],
  ])('certyfikat dostawcy %s nie zastępuje innego dostawcy', (ruleId, jd, unrelatedId) => {
    const report = auditKnockouts(jd, vaultWith([unrelatedId]));

    expect(report.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(false);
  });

  it('doświadczenie w chmurze bez potwierdzenia certyfikatu nie spełnia wymogu certyfikatu', () => {
    const report = auditKnockouts(
      'Wymagany certyfikat AWS.',
      vaultWith([], 'Administracja usługami AWS w środowisku produkcyjnym'),
    );

    expect(report.findings.find((finding) => finding.ruleId === 'cloud_cert_aws')?.satisfied).toBe(false);
  });

  it('sama wzmianka o certyfikacie, z której CV wprost go wyklucza, nie jest dowodem', () => {
    const report = auditKnockouts('Wymagane CCNA.', vaultWith([], 'CCNA bez certyfikatu'));

    expect(report.findings.find((finding) => finding.ruleId === 'cisco_ccna')?.satisfied).toBe(false);
  });
});

describe('Macierz kwalifikacji z różnych branż', () => {
  const qualificationCases = [
    ['prawo jazdy A', 'prawo jazdy kat. A', 'Prawo jazdy kategorii A', 'Prawo jazdy kat. B', 'license_a'],
    ['prawo jazdy B', 'prawo jazdy kat. B', 'Prawo jazdy kat B', 'Prawo jazdy kat. C', 'license_b'],
    ['prawo jazdy C', 'prawo jazdy kat. C', 'Prawo jazdy kat. C', 'Prawo jazdy kat. B', 'license_c'],
    ['prawo jazdy C+E', 'prawo jazdy kat. C+E', 'Prawo jazdy kat. C+E', 'Prawo jazdy kat. C', 'license_ce'],
    ['prawo jazdy D', 'prawo jazdy kat. D', 'Prawo jazdy kat. D', 'Prawo jazdy kat. C', 'license_d'],
    ['SEP G1', 'uprawnienia SEP G1', 'SEP G-1 — eksploatacja', 'SEP G3 — eksploatacja', 'sep_g1'],
    ['SEP G2', 'uprawnienia SEP G2', 'SEP G 2 — dozór', 'SEP G1 — dozór', 'sep_g2'],
    ['SEP G3', 'uprawnienia SEP G3', 'SEP G3 — eksploatacja', 'SEP G1 — eksploatacja', 'sep_g3'],
    ['F-Gaz', 'certyfikat F-Gaz', 'Certyfikat F-GAS Personel', 'Doświadczenie w chłodnictwie bez certyfikatu F-Gaz', 'fgas'],
    ['UDT wózki', 'uprawnienia UDT na wózki widłowe', 'UDT II WJO — wózki widłowe', 'UDT na suwnice', 'udt_forklift'],
    ['UDT suwnice', 'uprawnienia UDT na suwnice', 'UDT — suwnice', 'UDT na wózki widłowe', 'udt_suwnice'],
    ['UDT podesty', 'uprawnienia UDT na podesty ruchome', 'UDT — podesty ruchome', 'UDT na wózki widłowe', 'udt_lift'],
    ['UDT urządzenia ciśnieniowe', 'uprawnienia UDT na urządzenia ciśnieniowe', 'UDT — urządzenia ciśnieniowe', 'UDT na suwnice', 'udt_pressure'],
    ['spawanie TIG', 'uprawnienia spawalnicze TIG', 'TIG 141 — uprawnienia spawalnicze', 'MAG 135 — uprawnienia spawalnicze', 'welding'],
    ['sanepid', 'książeczka sanepidowska', 'Aktualna książeczka sanitarno-epidemiologiczna', 'Aktualne badania lekarskie bez książeczki sanepidowskiej', 'sanepid'],
    ['HACCP', 'certyfikat HACCP', 'Certyfikat HACCP', 'Certyfikat CCNA', 'haccp'],
    ['badania lekarskie', 'aktualne orzeczenie lekarskie', 'Aktualne orzeczenie lekarskie', 'Książeczka sanepidowska', 'medical_clearance'],
    ['praca na wysokości', 'uprawnienia do pracy na wysokości', 'Uprawnienia do pracy na wysokości', 'Uprawnienia UDT na wózki widłowe', 'height_work'],
    ['certyfikat Azure', 'certyfikat Azure', 'Certyfikat Microsoft Azure', 'Praktyczna znajomość Azure bez certyfikatu', 'cloud_cert_azure'],
    ['Scrum Master', 'certyfikat PSM I', 'PSM I — Scrum.org', 'SM I i doświadczenie w agile', 'scrum_master'],
    ['Cisco CCNA', 'certyfikat CCNA', 'Cisco CCNA', 'Cisco CCNP', 'cisco_ccna'],
  ] as const;

  it.each(qualificationCases)(
    '%s: właściwy dowód jest uznany, obcy zakres i negacja nie są, a wymóg opcjonalny nie blokuje',
    (_name, requirement, positiveEvidence, unrelatedEvidence, ruleId) => {
      const required = auditKnockouts(`Wymagane ${requirement}.`, vaultWith([], positiveEvidence))
        .findings.find((finding) => finding.ruleId === ruleId);
      const unrelated = auditKnockouts(`Wymagane ${requirement}.`, vaultWith([], unrelatedEvidence))
        .findings.find((finding) => finding.ruleId === ruleId);
      const negated = auditKnockouts(`Wymagane ${requirement}.`, vaultWith([], `Nie posiadam ${positiveEvidence}`))
        .findings.find((finding) => finding.ruleId === ruleId);
      const optional = auditKnockouts(`Mile widziane ${requirement}.`, vaultWith([]))
        .findings.find((finding) => finding.ruleId === ruleId);
      const candidate = vaultWith([]);
      candidate.personalInfo.summary = 'Doświadczenie zawodowe w obsłudze procesów i użytkowników.';
      const baseline = scoreCanonicalAts(candidate, 'Wymagana dyspozycyjność do pracy zmianowej.');
      const canonical = scoreCanonicalAts(
        candidate,
        `Wymagana dyspozycyjność do pracy zmianowej. Mile widziane ${requirement}.`,
      );
      const label = KNOCKOUT_RULES.find((rule) => rule.id === ruleId)?.label;

      expect(required?.severity).toBe('knockout');
      expect(required?.satisfied).toBe(true);
      expect(required?.matchedVia).toBe('text');
      expect(unrelated?.satisfied).toBe(false);
      expect(unrelated?.matchedVia).toBeNull();
      expect(negated?.satisfied).toBe(false);
      expect(negated?.matchedVia).toBeNull();
      expect(optional?.severity).toBe('preferred');
      expect(canonical.formalFindings).toContainEqual({
        label,
        satisfied: false,
        severity: 'preferred',
      });
      expect(canonical.missingRequirements).not.toContain(label);
      expect(canonical.components.formal).toBe(baseline.components.formal);
      expect(canonical.score).toBe(baseline.score);
    },
  );

  it.each(qualificationCases)(
    '%s: opis kwalifikacji w profilu kandydata nie staje się wymaganiem oferty',
    (_name, requirement) => {
      const report = auditKnockouts(
        `Opis profilu: kandydat w profilu ma wyłącznie ${requirement}.`,
        vaultWith([]),
      );

      expect(report.findings).toEqual([]);
      expect(report.requirementCount).toBe(0);
    },
  );
});

describe('Dowód uprawnienia a samo doświadczenie', () => {
  it.each([
    ['F-Gaz', 'Certyfikat F-Gaz wymagany.', 'Montaż i serwis instalacji F-Gaz', 'fgas'],
    ['UDT suwnice', 'Wymagane uprawnienia UDT na suwnice.', 'Obsługa suwnicy w zakładzie produkcyjnym', 'udt_suwnice'],
    ['spawanie TIG', 'Wymagane uprawnienia spawalnicze TIG.', 'Spawanie TIG 141 konstrukcji stalowych', 'welding'],
    ['SEP G3', 'Wymagane uprawnienia SEP G3.', 'Serwis instalacji SEP G3', 'sep_g3'],
  ])('%s: doświadczenie bez potwierdzenia dokumentu nie jest uprawnieniem', (_name, jd, experience, ruleId) => {
    const finding = auditKnockouts(jd, vaultWith([], experience))
      .findings.find((item) => item.ruleId === ruleId);

    expect(finding?.satisfied).toBe(false);
    expect(finding?.matchedVia).toBeNull();
  });

  it('jawne potwierdzenie uprawnienia zostaje uznane mimo typowej literówki', () => {
    const finding = auditKnockouts(
      'Wymagane uprawnienia SEP G3.',
      vaultWith([], 'Doświadczenie w serwisie kotłów. Uprawienia SEP G3.'),
    ).findings.find((item) => item.ruleId === 'sep_g3');

    expect(finding?.satisfied).toBe(true);
    expect(finding?.matchedVia).toBe('text');
  });

  it.each([
    ['SEP G1', 'SEP G1', 'sep_g1'],
    ['SEP G2', 'SEP G2', 'sep_g2'],
    ['SEP G3', 'SEP G3', 'sep_g3'],
    ['UDT na wózki widłowe', 'UDT na wózki widłowe', 'udt_forklift'],
    ['certyfikat F-Gaz', 'certyfikat F-Gaz', 'fgas'],
    ['uprawnienia spawalnicze TIG', 'uprawnienia spawalnicze TIG', 'welding'],
    ['książeczka sanepidowska', 'książeczka sanepidowska', 'sanepid'],
  ])('%s: literówka we wspólnym słowie „uprawnienia” nie psuje dopasowania', (_name, evidence, ruleId) => {
    const requirement = ruleId === 'fgas'
      ? 'Wymagany certyfikat F-Gaz.'
      : ruleId === 'sanepid'
        ? 'Wymagana książeczka sanepidowska.'
        : ruleId === 'welding'
          ? 'Wymagane uprawnienia spawalnicze TIG.'
          : ruleId === 'udt_forklift'
            ? 'Wymagane uprawnienia UDT na wózki widłowe.'
            : `Wymagane uprawnienia ${evidence}.`;
    const finding = auditKnockouts(requirement, vaultWith([], `Uprawienia ${evidence}`))
      .findings.find((item) => item.ruleId === ruleId);

    expect(finding?.satisfied).toBe(true);
    expect(finding?.matchedVia).toBe('text');
  });

  it.each([
    ['prawo jazdy B', 'Wymagane prawo jazdy kat. B.', 'Pracowałem jako kierowca kat. B.', 'license_b'],
    ['prawo jazdy C', 'Wymagane prawo jazdy kat. C.', 'Mam doświadczenie jako kierowca kat. C.', 'license_c'],
    ['SEP G1', 'Wymagane uprawnienia SEP G1.', 'Pracowałem przy instalacjach SEP G1.', 'sep_g1'],
    ['SEP G2', 'Wymagane uprawnienia SEP G2.', 'Serwisowałem urządzenia SEP G2.', 'sep_g2'],
    ['SEP G3', 'Wymagane uprawnienia SEP G3.', 'Serwisowałem instalacje SEP G3.', 'sep_g3'],
    ['UDT wózki', 'Wymagane uprawnienia UDT na wózki widłowe.', 'Obsługiwałem wózki widłowe.', 'udt_forklift'],
    ['UDT podesty', 'Wymagane uprawnienia UDT na podesty ruchome.', 'Pracowałem na podestach ruchomych.', 'udt_lift'],
    ['UDT ciśnieniowe', 'Wymagane uprawnienia UDT na urządzenia ciśnieniowe.', 'Obsługiwałem urządzenia ciśnieniowe.', 'udt_pressure'],
    ['F-Gaz', 'Wymagany certyfikat F-Gaz.', 'Serwisowałem układy F-Gaz.', 'fgas'],
    ['spawanie TIG', 'Wymagane uprawnienia spawalnicze TIG.', 'Spawałem metodą TIG 141.', 'welding'],
    ['sanepid', 'Wymagana książeczka sanepidowska.', 'Pracowałem w gastronomii z żywnością.', 'sanepid'],
    ['HACCP', 'Wymagany certyfikat HACCP.', 'Pracowałem w zakładzie stosującym HACCP.', 'haccp'],
    ['praca na wysokości', 'Wymagane uprawnienia do pracy na wysokości.', 'Wykonywałem prace na wysokości.', 'height_work'],
  ])('%s: wykonywanie podobnej pracy samo nie potwierdza kwalifikacji', (_name, jd, experience, ruleId) => {
    const finding = auditKnockouts(jd, vaultWith([], experience))
      .findings.find((item) => item.ruleId === ruleId);

    expect(finding?.satisfied).toBe(false);
    expect(finding?.matchedVia).toBeNull();
  });
});

describe('Zawody techniczne — to, czego stary audyt nie widział', () => {
  it('monter kotłów: wykrywa SEP G3 i F-Gaz', () => {
    const jd = `Poszukujemy serwisanta kotłów gazowych. Wymagane uprawnienia SEP G3
      oraz certyfikat F-Gaz. Mile widziane doświadczenie z marką Junkers.`;

    const report = auditKnockouts(jd, vaultWith([]));
    const ids = report.blocking.map((f) => f.ruleId);

    expect(ids).toContain('sep_g3');
    expect(ids).toContain('fgas');
  });

  it('zaznaczone uprawnienie w profilu spełnia wymaganie', () => {
    const jd = 'Wymagane uprawnienia SEP G3 (gazowe).';

    const report = auditKnockouts(jd, vaultWith(['sep_g3']));

    expect(report.blocking).toHaveLength(0);
    expect(report.findings[0].satisfied).toBe(true);
    expect(report.findings[0].matchedVia).toBe('license');
  });

  it.each([
    ['bez dopisku o rodzaju', 'Uprawnienia SEP G3', true],
    ['z typową literówką w słowie uprawnienia', 'Uprawienia SEP G3', true],
    ['z numerem grupy zapisanym ze spacją', 'Uprawnienia SEP G 3', true],
    ['bez podanej grupy', 'Uprawienia SEP', false],
    ['z grupą wyraźnie wykluczoną', 'Uprawnienia SEP (bez G3)', false],
    ['z inną grupą', 'Uprawnienia SEP G1', false],
  ])('tekst CV: %s', (_caseName, evidence, expected) => {
    const report = auditKnockouts(
      'Wymagane uprawnienia SEP G3.',
      vaultWith([], evidence),
    );

    expect(report.findings[0].satisfied).toBe(expected);
    expect(report.findings[0].matchedVia).toBe(expected ? 'text' : null);
  });

  it.each([
    ['SEP G1', 'Wymagane SEP G1.', 'SEP G-2 — eksploatacja', 'sep_g1'],
    ['SEP G1', 'Wymagane SEP G1.', 'SEP G3 — eksploatacja', 'sep_g1'],
    ['SEP G2', 'Wymagane SEP G2.', 'SEP G1 — eksploatacja', 'sep_g2'],
    ['SEP G2', 'Wymagane SEP G2.', 'SEP G3 — eksploatacja', 'sep_g2'],
    ['SEP G3', 'Wymagane SEP G3.', 'SEP G 1 — eksploatacja', 'sep_g3'],
    ['SEP G3', 'Wymagane SEP G3.', 'SEP G2 — eksploatacja', 'sep_g3'],
  ])('%s nie jest potwierdzane przez inną grupę', (_name, jd, evidence, ruleId) => {
    const finding = auditKnockouts(jd, vaultWith([], evidence)).findings.find((item) => item.ruleId === ruleId);

    expect(finding).toBeDefined();
    expect(finding?.satisfied).toBe(false);
    expect(finding?.matchedVia).toBeNull();
  });

  it('nie tworzy wymagania SEP G3 z ogólnej wzmianki o uprawnieniach gazowych', () => {
    const report = auditKnockouts('Wymagane uprawnienia gazowe.', vaultWith([]));

    expect(report.findings.map((finding) => finding.ruleId)).not.toContain('sep_g3');
  });

  it.each([
    ['ogólne uprawnienia elektryczne', 'Wymagane uprawnienia elektryczne.', ['sep_g1']],
    ['ogólne uprawnienia cieplne', 'Wymagane uprawnienia cieplne.', ['sep_g2']],
    ['ogólne uprawnienia energetyczne', 'Wymagane uprawnienia energetyczne.', ['sep_g2']],
    ['praca z czynnikiem chłodniczym', 'Wymagane doświadczenie w pracy z czynnikami chłodniczymi.', ['fgas']],
  ])('%s nie jest zamieniane na konkretny certyfikat', (_caseName, jd, forbiddenRuleIds) => {
    const report = auditKnockouts(jd, vaultWith([]));

    expect(report.findings.map((finding) => finding.ruleId))
      .not.toEqual(expect.arrayContaining(forbiddenRuleIds));
  });

  it('ogólne uprawnienia elektryczne bez grupy nie potwierdzają SEP G1', () => {
    const report = auditKnockouts('Wymagane uprawnienia SEP G1.', vaultWith([], 'Uprawnienia elektryczne'));

    expect(report.findings.find((finding) => finding.ruleId === 'sep_g1')?.satisfied).toBe(false);
  });

  it.each([
    ['G1 D1', 'Wymagane uprawnienia SEP G1 D1 do 1 kV.', 'sep_g1_d_1kv', 'sep_g1_e_1kv', 'sep_1kv'],
    ['G1 E1', 'Wymagane uprawnienia SEP G1 E1 do 1 kV.', 'sep_g1_e_1kv', 'sep_g1_d_1kv', 'sep_1kv'],
    ['G2 E2', 'Wymagane uprawnienia SEP G2 E2.', 'sep_g2_e', 'sep_g2_d', 'sep_g2'],
    ['G2 D2', 'Wymagane uprawnienia SEP G2 D2.', 'sep_g2_d', 'sep_g2_e', 'sep_g2'],
    ['G3 E3', 'Wymagane uprawnienia SEP G3 E3.', 'sep_g3_e', 'sep_g3_d', 'sep_g3'],
    ['G3 D3', 'Wymagane uprawnienia SEP G3 D3.', 'sep_g3_d', 'sep_g3_e', 'sep_g3'],
  ])('%s: zgodny zakres jest uznany, przeciwna rola i ogólny wpis nie wystarczą', (_scope, jd, matchingId, oppositeId, genericId) => {
    const ruleId = matchingId;
    const matching = auditKnockouts(jd, vaultWith([matchingId]));
    const opposite = auditKnockouts(jd, vaultWith([oppositeId]));
    const generic = auditKnockouts(jd, vaultWith([genericId]));

    expect(matching.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(true);
    expect(opposite.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(false);
    expect(generic.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(false);
    expect(generic.findings.some((finding) => finding.ruleId === 'sep_' + ruleId.split('_')[1])).toBe(false);
  });

  it.each([
    ['SEP G1 D1', 'Wymagane SEP G1 D1 do 1 kV.', 'SEP G1 D1 — dozór', 'SEP G1 E1 — eksploatacja', 'sep_g1_d_1kv'],
    ['SEP G2 E2', 'Wymagane SEP G2 E2.', 'SEP G2 E2 — eksploatacja', 'SEP G2 D2 — dozór', 'sep_g2_e'],
    ['SEP G3 D3', 'Wymagane SEP G3 D3.', 'SEP G3 D3 — dozór', 'SEP G3 E3 — eksploatacja', 'sep_g3_d'],
  ])('%s: opis w CV musi potwierdzać ten sam zakres E/D', (_scope, jd, matchingText, oppositeText, ruleId) => {
    const matching = auditKnockouts(jd, vaultWith([], matchingText));
    const opposite = auditKnockouts(jd, vaultWith([], oppositeText));

    expect(matching.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(true);
    expect(opposite.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(false);
  });

  it('opcjonalne E/D nie zmiękcza osobnego, ogólnego wymogu tej samej grupy SEP', () => {
    const report = auditKnockouts(
      'Wymagane SEP G1 do 1 kV, mile widziane SEP G1 D1.',
      vaultWith([]),
    );
    const general = report.findings.find((finding) => finding.ruleId === 'sep_g1');
    const specific = report.findings.find((finding) => finding.ruleId === 'sep_g1_d_1kv');

    expect(general?.severity).toBe('knockout');
    expect(specific?.severity).toBe('preferred');
    expect(report.blocking.map((finding) => finding.ruleId)).toContain('sep_g1');
    expect(report.blocking.map((finding) => finding.ruleId)).not.toContain('sep_g1_d_1kv');
  });

  it.each(['sep_above_1kv', 'sep_g1_15kv', 'sep_g1_d'])('zakres SEP poza potwierdzonym do 1 kV nie jest zaliczany (%s)', (licenseId) => {
    const report = auditKnockouts('Wymagane SEP G1 do 1 kV.', vaultWith([licenseId]));

    expect(report.findings.find((finding) => finding.ruleId === 'sep_g1')?.satisfied).toBe(false);
  });

  it('magazynier: „wózki widłowe” spełnia zaznaczenie UDT', () => {
    // To jest dokładnie ten przypadek, który wcześniej nie działał: audyt
    // szukał dosłownego ciągu w JSON.stringify(vault), więc identyfikator
    // 'udt_forklift' nie miał szans dopasować się do treści ogłoszenia.
    const jd = 'Praca w magazynie. Wymagane uprawnienia na wózki widłowe (UDT).';

    const withLicense = auditKnockouts(jd, vaultWith(['udt_forklift']));
    const without = auditKnockouts(jd, vaultWith([]));

    expect(withLicense.blocking).toHaveLength(0);
    expect(without.blocking.map((f) => f.ruleId)).toContain('udt_forklift');
  });

  it('zaznaczona suwnica nie spełnia osobnego wymogu na wózki widłowe', () => {
    const report = auditKnockouts(
      'Wymagane uprawnienia UDT na wózki widłowe.',
      vaultWith(['udt_crane']),
    );

    expect(report.findings.find((finding) => finding.ruleId === 'udt_forklift')?.satisfied).toBe(false);
  });

  it.each([
    ['suwnice', 'Wymagane uprawnienia UDT na suwnice.', 'udt_dzwigi'],
    ['dźwigi', 'Wymagane uprawnienia UDT na dźwigi.', 'udt_suwnice'],
    ['HDS', 'Wymagane uprawnienia UDT na HDS.', 'udt_zurawie'],
    ['żurawie', 'Wymagane uprawnienia UDT na żurawie.', 'udt_hds'],
  ])('UDT: kwalifikacja na %s nie zastępuje innego rodzaju urządzenia', (_name, jd, unrelatedId) => {
    const report = auditKnockouts(jd, vaultWith([unrelatedId]));
    const targetId = jd.match(/suwnice|dźwigi|HDS|żurawie/i)?.[0].toLowerCase();
    const ruleId = targetId === 'suwnice' ? 'udt_suwnice'
      : targetId === 'dźwigi' ? 'udt_dzwigi'
        : targetId === 'hds' ? 'udt_hds' : 'udt_zurawie';

    expect(report.findings.find((finding) => finding.ruleId === ruleId)?.satisfied).toBe(false);
  });

  it('stare, nieokreślone UDT dźwigowe spełnia wymóg ogólny, nie konkretną maszynę', () => {
    expect(auditKnockouts('Wymagane uprawnienia UDT na urządzenia dźwigowe.', vaultWith(['udt_crane']))
      .findings.find((finding) => finding.ruleId === 'udt_crane')?.satisfied).toBe(true);
    expect(auditKnockouts('Wymagane uprawnienia UDT na suwnice.', vaultWith(['udt_crane']))
      .findings.find((finding) => finding.ruleId === 'udt_suwnice')?.satisfied).toBe(false);
  });

  it.each([
    ['wózki widłowe', 'wózki widłowe (UDT)', 'operator suwnicy z uprawnieniami UDT'],
    ['suwnice', 'suwnice (UDT)', 'operator wózka widłowego z uprawnieniami UDT'],
  ])('UDT: %s nie jest potwierdzane innym rodzajem urządzenia', (_name, jd, evidence) => {
    const report = auditKnockouts(`Wymagane uprawnienia na ${jd}.`, vaultWith([], evidence));
    const targetId = jd.startsWith('wózki') ? 'udt_forklift' : 'udt_suwnice';
    const finding = report.findings.find((item) => item.ruleId === targetId);

    expect(finding).toBeDefined();
    expect(finding?.satisfied).toBe(false);
  });

  it('spawacz: wykrywa metody po numerach', () => {
    const jd = 'Spawacz TIG 141 / MAG 135. Wymagana książeczka spawacza.';

    const report = auditKnockouts(jd, vaultWith([]));

    expect(report.blocking.map((f) => f.ruleId)).toContain('welding');
  });

  it.each([
    ['TIG', 'welding_tig', 'welding_mag'],
    ['MAG', 'welding_mag', 'welding_mig'],
    ['MIG', 'welding_mig', 'welding_tig'],
  ])('zaznaczone uprawnienie %s nie zastępuje innej metody', (method, heldId, unrelatedId) => {
    const report = auditKnockouts(`Wymagane uprawnienia spawalnicze ${method}.`, vaultWith([unrelatedId]));

    expect(report.findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(false);
    expect(auditKnockouts(`Wymagane uprawnienia spawalnicze ${method}.`, vaultWith([heldId]))
      .findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(true);
  });

  it('kilka wymaganych metod spawania wymaga każdej metody z osobna', () => {
    const requirement = 'Wymagane uprawnienia spawalnicze TIG i MAG.';
    const tigOnly = auditKnockouts(requirement, vaultWith(['welding_tig']));
    const magOnly = auditKnockouts(requirement, vaultWith(['welding_mag']));
    const both = auditKnockouts(requirement, vaultWith(['welding_tig', 'welding_mag']));

    expect(tigOnly.findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(false);
    expect(magOnly.findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(false);
    expect(both.findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(true);
  });

  it('nieokreślona metoda spawania spełnia tylko ogólny wymóg spawalniczy', () => {
    expect(auditKnockouts('Wymagane uprawnienia spawalnicze.', vaultWith(['welding_tig_mig']))
      .findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(true);
    expect(auditKnockouts('Wymagane uprawnienia spawalnicze TIG.', vaultWith(['welding_tig_mig']))
      .findings.find((finding) => finding.ruleId === 'welding')?.satisfied).toBe(false);
  });

  it('kierowca: rozróżnia kat. C+E od kat. B', () => {
    const jd = 'Kierowca kat. C+E w transporcie międzynarodowym.';

    const report = auditKnockouts(jd, vaultWith(['b_license']));
    expect(report.blocking.map((f) => f.ruleId)).not.toContain('license_ce');
    expect(report.unclassified.map((f) => f.ruleId)).toContain('license_ce');
  });

  it('sama kat. C nie potwierdza C+E, a C+E potwierdza C', () => {
    const cOnly = auditKnockouts('Wymagane prawo jazdy kat. C+E.', vaultWith(['c_license']));
    const ce = auditKnockouts('Wymagane prawo jazdy kat. C oraz C+E.', vaultWith(['ce_license']));

    expect(cOnly.blocking.map((finding) => finding.ruleId)).toContain('license_ce');
    expect(ce.findings.find((finding) => finding.ruleId === 'license_c')?.satisfied).toBe(true);
    expect(ce.findings.find((finding) => finding.ruleId === 'license_ce')?.satisfied).toBe(true);
  });

  it('sprzątaczka: wykrywa orzeczenie sanepidu', () => {
    const jd = `Sprzątanie obiektów spożywczych. Wymagana aktualna książeczka
      sanitarno-epidemiologiczna oraz praca w systemie zmianowym.`;

    const report = auditKnockouts(jd, vaultWith([]));
    const ids = report.blocking.map((f) => f.ruleId);

    expect(ids).toContain('sanepid');
    expect(ids).toContain('shift_work');
  });

  it('uprawnienie opisane własnymi słowami w CV też się liczy', () => {
    const jd = 'Wymagane uprawnienia na wózki widłowe.';
    const vault = vaultWith([], 'Posiadane uprawnienia UDT na wózki widłowe czołowe');

    const report = auditKnockouts(jd, vault);

    expect(report.blocking).toHaveLength(0);
    expect(report.findings[0].matchedVia).toBe('text');
  });

  it.each([
    ['SEP G1', 'Wymagane SEP G-1.', 'SEP G 1 — eksploatacja', 'SEP G3', 'sep_g1'],
    ['SEP G2', 'Wymagane uprawnienia SEP G 2.', 'Uprawnienia SEP G2', 'SEP G1', 'sep_g2'],
    ['F-Gaz', 'Wymagany certyfikat F-Gaz.', 'Certyfikat F gaz', 'Nie posiadam F-Gaz', 'fgas'],
    ['UDT wózki', 'Wymagane uprawnienia na wózki widłowe (UDT).', 'UDT — wózki widłowe', 'Nie mam UDT na wózki widłowe', 'udt_forklift'],
    ['spawanie TIG', 'Wymagane uprawnienia spawalnicze TIG.', 'Uprawnienia spawalnicze TIG 141', 'Nie mam uprawnień spawalniczych TIG', 'welding'],
    ['sanepid', 'Wymagana książeczka sanepidowska.', 'Aktualna książeczka sanepidowska', 'Nie posiadam książeczki sanepidowskiej', 'sanepid'],
    ['prawo jazdy B', 'Wymagane prawo jazdy kat. B.', 'Prawo jazdy kat B', 'Prawo jazdy kat. C', 'license_b'],
  ])('wymagania %s: warianty tekstowe nie mieszają się między rodzinami', (_name, jd, positive, negative, ruleId) => {
    const positiveFinding = auditKnockouts(jd, vaultWith([], positive)).findings.find((f) => f.ruleId === ruleId);
    const negativeFinding = auditKnockouts(jd, vaultWith([], negative)).findings.find((f) => f.ruleId === ruleId);

    expect(positiveFinding?.satisfied).toBe(true);
    expect(positiveFinding?.matchedVia).toBe('text');
    expect(negativeFinding?.satisfied).toBe(false);
    expect(negativeFinding?.matchedVia).toBeNull();
  });

  it.each([
    [
      'F-Gaz — zapis z odstępem i wariant angielski',
      'Wymagany certyfikat F gaz.',
      'F-GAS Personel',
      'Doświadczenie w chłodnictwie bez certyfikatu F-Gaz',
      'fgas',
    ],
    [
      'UDT — literówka w opisie wózka, właściwy typ uprawnienia',
      'Wymagane uprawnienia na wózki widłowe UDT.',
      'Uprawienia UDT na wózki widłowe',
      'Uprawnienia UDT na suwnice',
      'udt_forklift',
    ],
    [
      'sanepid — nazwa formalna i nazwa potoczna',
      'Wymagana książeczka sanitarno-epidemiologiczna.',
      'Aktualna książeczka sanepidowska',
      'Aktualne badania lekarskie bez książeczki sanepidowskiej',
      'sanepid',
    ],
    [
      'spawanie — metoda pozostaje rozstrzygająca',
      'Wymagane uprawnienia spawalnicze TIG.',
      'TIG 141 — uprawnienia spawalnicze',
      'MAG 135 — uprawnienia spawalnicze',
      'welding',
    ],
  ])('%s: wariant zapisu działa, a inna kwalifikacja nie zastępuje wymaganej', (_name, jd, positive, negative, ruleId) => {
    const positiveFinding = auditKnockouts(jd, vaultWith([], positive)).findings.find((finding) => finding.ruleId === ruleId);
    const negativeFinding = auditKnockouts(jd, vaultWith([], negative)).findings.find((finding) => finding.ruleId === ruleId);

    expect(positiveFinding?.satisfied).toBe(true);
    expect(positiveFinding?.matchedVia).toBe('text');
    expect(negativeFinding?.satisfied).toBe(false);
    expect(negativeFinding?.matchedVia).toBeNull();
  });

  it.each([
    ['SEP bez grupy', 'Wymagane SEP G3.', 'Uprawnienia SEP'],
    ['SEP z inną grupą', 'Wymagane SEP G3.', 'Uprawnienia SEP G1'],
    ['UDT bez rodzaju urządzenia', 'Wymagane uprawnienia UDT na wózki widłowe.', 'Uprawnienia UDT'],
    ['prawo jazdy bez kategorii', 'Wymagane prawo jazdy kat. B.', 'Prawo jazdy'],
  ])('%s nie potwierdza kwalifikacji o węższym zakresie', (_name, jd, evidence) => {
    const report = auditKnockouts(jd, vaultWith([], evidence));
    expect(report.findings.some((finding) => finding.satisfied && finding.matchedVia === 'text')).toBe(false);
  });
});

describe('Zdania przeczące i łagodzące', () => {
  it.each([
    ['SEP', 'Obowiązki:\n- Serwis urządzeń SEP G3.', 'sep_g3'],
    ['UDT', 'Zakres obowiązków: obsługa wózka widłowego.', 'udt_forklift'],
    ['spawanie', 'Zadania:\r\n- Spawanie metodą TIG.', 'welding'],
    ['prawo jazdy', 'Opis stanowiska: prowadzenie pojazdu kat. C+E.', 'license_ce'],
  ])('%s wspomniane wyłącznie w obowiązkach nie jest twardym wymaganiem', (_name, jd, ruleId) => {
    const report = auditKnockouts(jd, vaultWith([]));
    const finding = report.findings.find((item) => item.ruleId === ruleId);

    expect(finding?.severity).toBe('information');
    expect(report.blocking.map((item) => item.ruleId)).not.toContain(ruleId);
    expect(report.requirementCount).toBe(0);
    expect(report.unclassified.map((item) => item.ruleId)).toContain(ruleId);
  });

  it.each([
    ['SEP', 'Wymagania:\n- Uprawnienia SEP G3.', 'sep_g3'],
    ['UDT', 'Wymagania obowiązkowe:\r\n- Uprawnienia na wózki widłowe UDT.', 'udt_forklift'],
    ['spawanie', 'Requirements:\n- Welding TIG qualifications.', 'welding'],
    ['prawo jazdy', 'Minimum qualifications:\n- Driving license C+E.', 'license_ce'],
    ['certyfikat zwykle preferowany', 'Wymagania:\n- HACCP.', 'haccp'],
  ])('%s pod nagłówkiem wymagań jest wymagane bez powtarzania słowa „wymagane”', (_name, jd, ruleId) => {
    const report = auditKnockouts(jd, vaultWith([]));

    expect(report.blocking.map((item) => item.ruleId)).toContain(ruleId);
  });

  it.each([
    ['SEP', 'Mile widziane:\n- Uprawnienia SEP G3.', 'sep_g3'],
    ['UDT', 'Nice to have:\n- Uprawnienia UDT na wózki widłowe.', 'udt_forklift'],
  ])('%s pod nagłówkiem opcjonalnym nie blokuje', (_name, jd, ruleId) => {
    const report = auditKnockouts(jd, vaultWith([]));

    expect(report.blocking.map((item) => item.ruleId)).not.toContain(ruleId);
    expect(report.optional.map((item) => item.ruleId)).toContain(ruleId);
  });

  it('jawny wymóg ma pierwszeństwo przed wcześniejszą wzmianką w obowiązkach', () => {
    const report = auditKnockouts(
      'Obowiązki: obsługa wózka widłowego. Wymagania: uprawnienia UDT na wózki widłowe.',
      vaultWith([]),
    );

    expect(report.blocking.map((item) => item.ruleId)).toContain('udt_forklift');
    expect(report.unclassified.map((item) => item.ruleId)).not.toContain('udt_forklift');
  });

  it('wzmianka informacyjna nie jest brakiem formalnym w kanonicznym wyniku', () => {
    const jd = 'Zakres obowiązków: obsługa wózka widłowego oraz kompletacja zamówień.';
    const vault = vaultWith([]);
    vault.skillsMatrix.hardSkills = ['Kompletacja zamówień'];
    const result = scoreCanonicalAts(vault, jd);

    expect(result.formalFindings.find((item) => item.label.includes('wózki widłowe'))?.severity).toBe('information');
    expect(result.missingRequirements).not.toContain('Uprawnienia UDT — wózki widłowe');
  });

  it('opcjonalny znacznik inline nie zmiękcza wcześniejszego wymogu obowiązkowego', () => {
    const report = auditKnockouts(
      'Wymagane SEP G1, mile widziane SEP G3.',
      vaultWith([]),
    );
    const g1 = report.findings.find((finding) => finding.ruleId === 'sep_g1');
    const g3 = report.findings.find((finding) => finding.ruleId === 'sep_g3');

    expect(g1?.severity).toBe('knockout');
    expect(g3?.severity).toBe('preferred');
    expect(report.blocking.map((finding) => finding.ruleId)).toContain('sep_g1');
    expect(report.blocking.map((finding) => finding.ruleId)).not.toContain('sep_g3');
  });

  it('„nie wymagamy prawa jazdy” nie tworzy wymagania', () => {
    // Fałszywy alarm na tym ekranie kosztuje więcej niż przeoczenie: jedna
    // bzdura podważa całą listę, a to jest cała wartość darmowej checklisty.
    const report = auditKnockouts('Nie wymagamy prawa jazdy kat. B.', vaultWith([]));

    expect(report.findings.map((f) => f.ruleId)).not.toContain('license_b');
  });

  it('„bez konieczności posiadania uprawnień SEP” nie tworzy wymagania', () => {
    const report = auditKnockouts('Praca bez konieczności posiadania uprawnień SEP G1.', vaultWith([]));

    expect(report.findings.map((f) => f.ruleId)).not.toContain('sep_g1');
  });

  it('„mile widziane” obniża twarde wymaganie do zalecanego', () => {
    const report = auditKnockouts('Mile widziane uprawnienia na wózki widłowe.', vaultWith([]));

    expect(report.blocking).toHaveLength(0);
    expect(report.optional.map((f) => f.ruleId)).toContain('udt_forklift');
  });

  it.each([
    ['SEP G1', 'Wymagane uprawnienia SEP G1.', 'Nie mam uprawnień SEP G1.', 'sep_g1'],
    ['F-Gaz', 'Wymagany certyfikat F-Gaz.', 'Nie posiadam certyfikatu F-Gaz.', 'fgas'],
    ['UDT', 'Wymagane uprawnienia na wózki widłowe UDT.', 'Nie mam uprawnień UDT na wózki widłowe.', 'udt_forklift'],
    ['spawanie', 'Wymagane uprawnienia spawalnicze TIG.', 'Nie mam uprawnień spawalniczych TIG.', 'welding'],
    ['sanepid', 'Wymagana książeczka sanepidowska.', 'Nie posiadam książeczki sanepidowskiej.', 'sanepid'],
    ['badania', 'Wymagane aktualne orzeczenie lekarskie.', 'Nie posiadam aktualnego orzeczenia lekarskiego.', 'medical_clearance'],
    ['wysokość', 'Wymagane uprawnienia do pracy na wysokości.', 'Nie mam uprawnień do pracy na wysokości.', 'height_work'],
    ['zmiany', 'Wymagana dyspozycyjność do pracy zmianowej.', 'Nie jestem dyspozycyjny do pracy zmianowej.', 'shift_work'],
    ['angielski', 'Wymagany angielski C1.', 'Nie znam angielskiego na poziomie C1.', 'language_advanced'],
  ])('nie zalicza negacji jako potwierdzenia: %s', (_name, jd, evidence, ruleId) => {
    const vault = vaultWith([], evidence);
    const finding = auditKnockouts(jd, vault).findings.find((item) => item.ruleId === ruleId);

    expect(finding).toBeDefined();
    expect(finding?.satisfied).toBe(false);
    expect(finding?.matchedVia).toBeNull();
  });

  it('wymagany własny transport blokuje, a samo prawo jazdy go nie potwierdza', () => {
    const report = auditKnockouts('Wymagany własny samochód do pracy.', vaultWith(['b_license']));

    expect(report.blocking.map((finding) => finding.ruleId)).toContain('own_transport');
    expect(report.findings.find((finding) => finding.ruleId === 'own_transport')?.satisfied).toBe(false);
  });
});

describe('Ogłoszenia korporacyjne — brak regresji', () => {
  it('ogłoszenie IT nie generuje wymagań technicznych z innych branż', () => {
    const jd = `Frontend Developer. Wymagany React 19, TypeScript oraz znajomość
      angielskiego na poziomie C1. Praca zdalna.`;

    const report = auditKnockouts(jd, vaultWith([]));
    const ids = report.findings.map((f) => f.ruleId);

    expect(ids).toContain('language_advanced');
    expect(ids).not.toContain('sep_g1');
    expect(ids).not.toContain('udt_forklift');
    expect(ids).not.toContain('welding');
  });

  it('ogłoszenie bez wymagań formalnych daje pusty raport', () => {
    const report = auditKnockouts('Szukamy osoby chętnej do pracy w miłym zespole.', vaultWith([]));

    expect(report.requirementCount).toBe(0);
    expect(report.blocking).toHaveLength(0);
  });

  it('stawka godzinowa 135 zł/h i numer lokalu 141 nie wyzwalają wymogu spawania', () => {
    const jd = 'Oferujemy stawkę 135 zł/h brutto. Nasze biuro mieści się przy ul. Marszałkowskiej 141.';
    const report = auditKnockouts(jd, vaultWith([]));
    const ids = report.findings.map((f) => f.ruleId);
    expect(ids).not.toContain('welding');
  });

  it('prawo jazdy kat. C1 oraz sektor magazynu C1 nie wyzwalają wymogu języka angielskiego C1', () => {
    const jd = 'Wymagane prawo jazdy kat. C1, praca przy załadunku w sektorze C1 magazynu.';
    const report = auditKnockouts(jd, vaultWith([]));
    const ids = report.findings.map((f) => f.ruleId);
    expect(ids).not.toContain('language_advanced');
  });

  it('pusta treść ogłoszenia nie wywraca audytu', () => {
    expect(() => auditKnockouts('', vaultWith([]))).not.toThrow();
    expect(auditKnockouts('', vaultWith([])).requirementCount).toBe(0);
  });
});
