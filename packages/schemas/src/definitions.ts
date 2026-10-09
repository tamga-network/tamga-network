/**
 * Şema tanımları — kaynak SPEC-SCHEMA-0001 §4 (kök tip) ve SPEC-SCHEMA-0002 §2.4/§4/§5.
 * ADR-0010: vct = URN; schema_uri/metadata_url = schemas.tamga.network altında sürümlü dosya.
 * D1 (yayınlanmış metadata_url içeriği asla değişmez) build.ts'de hash ile kilitlenir.
 */
export const CATALOGUE_BASE = "https://schemas.tamga.network/v1";

export interface SchemaDef {
  vct: string;
  path: string; // CATALOGUE_BASE altı: core/TamgaBaseCredential/1.0.0
  metadataVersion: string; // minor/patch burada (ADR-0010 K4)
  layer: "NETWORK" | "NATIONAL";
  extends?: string; // vct of parent
  jsonSchema: Record<string, unknown>;
  typeMetadata: Record<string, unknown>; // extends/schema_uri/#integrity build'de doldurulur
}

// $ref: v1/edu/<Type>/1.0.0/schema.json → v1/core/... üç seviye yukarı (SPEC-SCHEMA-0002 örneğindeki ../../ bir seviye eksikti — erratum, DECISIONS §10.7)
const LANG = { $ref: "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" };
const DATE = { $ref: "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" };

/**
 * ADR-0029: geliştirme evresinde şemalar yerinde düzeltilir (sürüm geçişi yok; eski deneme belgeleri yeniden alınır).
 * Beta'da "stable" yapılır: D1 değişmezliği ve küçük sürüm kuralı (ADR-0010 K4) o andan itibaren uygulanır.
 */
export const SCHEMA_STAGE: "development" | "stable" = "development";

export const BASE: SchemaDef = {
  vct: "urn:tamga:core:TamgaBaseCredential:1",
  path: "core/TamgaBaseCredential/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/core/TamgaBaseCredential/1.0.0/schema.json`,
    title: "TamgaBaseCredential",
    type: "object",
    required: ["iss", "vct", "vct#integrity", "iat", "cnf"],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { type: "string", pattern: "^urn:tamga:" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      status: { type: "object" },
      category: { enum: ["urn:tamga:eaa:pub", "urn:tamga:eaa:qualified"] },
    },
    $defs: {
      LangString: {
        type: "object",
        minProperties: 1,
        propertyNames: { pattern: "^[a-z]{2}(-[A-Z]{2})?$" },
        additionalProperties: { type: "string", minLength: 1, maxLength: 500 },
      },
      DateOnly: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
      IssuerRef: {
        type: "object",
        required: ["issuer_id"],
        properties: { issuer_id: { type: "string", pattern: "^0x[0-9a-f]{64}$" } },
      },
    },
  },
  typeMetadata: {
    name: "Tamga Base Credential",
    description:
      "Root type of all Tamga credential types: iss, vct, vct#integrity, iat, cnf; conditional exp/status; optional category (ADR-0010).",
    display: [
      { lang: "tr-TR", name: "Tamga Belgesi" },
      { lang: "en-US", name: "Tamga Credential" },
    ],
    claims: [
      { path: ["iss"], sd: "never" },
      { path: ["vct"], sd: "never" },
      { path: ["vct#integrity"], sd: "never" },
      { path: ["iat"], sd: "never" },
      { path: ["cnf"], sd: "never" },
      { path: ["status"], sd: "never" },
      { path: ["category"], sd: "never" },
    ],
    tamga: { tier: "NETWORK", status: "ACTIVE" },
  },
};

export const STUDENT: SchemaDef = {
  vct: "urn:tamga:edu:StudentCredential:1",
  path: "edu/StudentCredential/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/edu/StudentCredential/1.0.0/schema.json`,
    title: "TamgaStudentCredential",
    type: "object",
    required: [
      "iss",
      "vct",
      "vct#integrity",
      "iat",
      "exp",
      "cnf",
      "family_name",
      "given_name",
      "birth_date",
      "awarding_body_name",
      "awarding_body_id",
      "awarding_body_country",
      "student_status",
      "enrollment_year",
      "study_level",
      "programme_title",
      "isced_f_code",
      "is_enrolled",
    ],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:edu:StudentCredential:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      category: { enum: ["urn:tamga:eaa:pub", "urn:tamga:eaa:qualified"] },
      family_name: { type: "string", minLength: 1, maxLength: 200 },
      given_name: { type: "string", minLength: 1, maxLength: 200 },
      birth_date: DATE,
      awarding_body_name: LANG,
      awarding_body_id: { type: "string", minLength: 1, maxLength: 64 },
      awarding_body_country: { type: "string", pattern: "^[A-Z]{2}$" },
      student_status: { enum: ["ACTIVE", "ON_LEAVE"] },
      enrollment_year: { type: "integer", minimum: 1900, maximum: 2200 },
      study_level: { type: "integer", minimum: 5, maximum: 8 },
      programme_title: LANG,
      isced_f_code: { type: "string", pattern: "^[0-9]{2,4}$" },
      faculty_name: LANG,
      expected_graduation_year: { type: "integer", minimum: 1900, maximum: 2200 },
      credit_points: { type: "number", minimum: 0, maximum: 1000 }, // AB EUHEPOE: program iş yükü (AKTS)
      enrollment_date: DATE, // AB EUHEPOE: kayıt tarihi
      is_enrolled: { type: "boolean" },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Student Credential",
    description: "Proves student status at a higher education institution.",
    display: [
      { lang: "tr-TR", name: "Öğrenci Belgesi", description: "Öğrencilik durumu" },
      { lang: "en-US", name: "Student Certificate", description: "Proof of enrolment" },
    ],
    claims: [
      { path: ["birth_date"], sd: "always" },
      { path: ["family_name"], sd: "always" },
      { path: ["given_name"], sd: "always" },
      {
        path: ["is_enrolled"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Aktif öğrenci" },
          { lang: "en-US", label: "Enrolled" },
        ],
      },
      {
        path: ["programme_title"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Program" },
          { lang: "en-US", label: "Programme" },
        ],
      },
      {
        path: ["awarding_body_name"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Kurum" },
          { lang: "en-US", label: "Institution" },
        ],
      },
      { path: ["study_level"], sd: "allowed", display: [{ lang: "tr-TR", label: "Seviye (EQF)" }] },
      { path: ["student_status"], sd: "allowed" },
      { path: ["enrollment_year"], sd: "allowed" },
      { path: ["isced_f_code"], sd: "allowed" },
      { path: ["faculty_name"], sd: "allowed" },
      { path: ["expected_graduation_year"], sd: "allowed" },
      { path: ["awarding_body_id"], sd: "allowed" },
      { path: ["awarding_body_country"], sd: "allowed" },
      {
        path: ["credit_points"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "AKTS" },
          { lang: "en-US", label: "ECTS credits" },
        ],
      },
      {
        path: ["enrollment_date"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Kayıt tarihi" },
          { lang: "en-US", label: "Enrolment date" },
        ],
      },
    ],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["EDUCATION"],
      default_ttl_days: 90,
      uses_status_list: false,
      min_issuer_assurance: "I2",
      min_binding_level: "T1",
      derived_claims: ["is_enrolled"],
      elm_profile: "ELM-3.3/LearningAchievement",
      elm_mapping: {
        profile: "DC4EU EUHEPOE (ELM 3.2)",
        claims: {
          family_name: "foaf:familyName",
          given_name: "foaf:givenName",
          birth_date: "elm:dateOfBirth",
          awarding_body_name: "elm:Organisation/elm:legalName",
          awarding_body_id: "elm:Organisation/elm:LegalIdentifier",
          awarding_body_country: "elm:location",
          programme_title: "elm:LearningAchievementSpecification/dc:title",
          credit_points: "elm:LearningAchievementSpecification/elm:creditPoint (ECTS)",
          enrollment_date: "elm:LearningOpportunity/dc:PeriodOfTime",
          study_level: "elm:eqfLevel",
          isced_f_code: "elm:educationSubject (ISCED-F)",
        },
      },
      status: "ACTIVE",
    },
  },
};

export const DIPLOMA: SchemaDef = {
  vct: "urn:tamga:edu:DiplomaCredential:1",
  path: "edu/DiplomaCredential/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/edu/DiplomaCredential/1.0.0/schema.json`,
    title: "TamgaDiplomaCredential",
    type: "object",
    required: [
      "iss",
      "vct",
      "vct#integrity",
      "iat",
      "cnf",
      "status",
      "family_name",
      "given_name",
      "birth_date",
      "awarding_body_name",
      "awarding_body_id",
      "awarding_body_country",
      "qualification_title",
      "eqf_level",
      "isced_f_code",
      "awarding_date",
      "is_graduate",
    ],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:edu:DiplomaCredential:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      cnf: { type: "object" },
      category: { enum: ["urn:tamga:eaa:pub", "urn:tamga:eaa:qualified"] },
      status: {
        type: "object",
        required: ["status_list"],
        properties: {
          status_list: {
            type: "object",
            required: ["idx", "uri"],
            properties: { idx: { type: "integer", minimum: 0 }, uri: { type: "string", format: "uri" } },
          },
        },
      },
      family_name: { type: "string", minLength: 1, maxLength: 200 },
      given_name: { type: "string", minLength: 1, maxLength: 200 },
      birth_date: DATE,
      awarding_body_name: LANG,
      awarding_body_id: { type: "string", minLength: 1, maxLength: 64 },
      awarding_body_country: { type: "string", pattern: "^[A-Z]{2}$" },
      qualification_title: LANG,
      eqf_level: { type: "integer", minimum: 5, maximum: 8 },
      nqf_level: { type: "string", maxLength: 16 },
      isced_f_code: { type: "string", pattern: "^[0-9]{2,4}$" },
      awarding_date: DATE,
      mode_of_study: { enum: ["FULL_TIME", "PART_TIME", "DISTANCE", "BLENDED"] },
      credit_points: { type: "number", minimum: 0, maximum: 1000 },
      grade: { type: "string", maxLength: 32 },
      grading_scheme: LANG,
      thesis_title: LANG,
      is_graduate: { const: true },
      graduated_before: { type: "integer", minimum: 1900, maximum: 2200 },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Diploma Credential",
    description: "Degree certificate issued by a higher education institution.",
    display: [
      { lang: "tr-TR", name: "Diploma", description: "Yükseköğretim mezuniyet belgesi" },
      { lang: "en-US", name: "Diploma", description: "Higher education degree" },
    ],
    claims: [
      { path: ["birth_date"], sd: "always" },
      {
        path: ["grade"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Not ortalaması" },
          { lang: "en-US", label: "Grade" },
        ],
      },
      { path: ["thesis_title"], sd: "always" },
      { path: ["family_name"], sd: "always" },
      { path: ["given_name"], sd: "always" },
      {
        path: ["is_graduate"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Mezun" },
          { lang: "en-US", label: "Graduate" },
        ],
      },
      {
        path: ["eqf_level"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Yeterlilik seviyesi (EQF)" },
          { lang: "en-US", label: "EQF level" },
        ],
      },
      {
        path: ["qualification_title"],
        sd: "allowed",
        display: [
          { lang: "tr-TR", label: "Derece" },
          { lang: "en-US", label: "Qualification" },
        ],
      },
      { path: ["awarding_body_name"], sd: "allowed", display: [{ lang: "tr-TR", label: "Kurum" }] },
      { path: ["awarding_date"], sd: "allowed", display: [{ lang: "tr-TR", label: "Mezuniyet tarihi" }] },
      { path: ["isced_f_code"], sd: "allowed" },
      { path: ["graduated_before"], sd: "allowed" },
      { path: ["mode_of_study"], sd: "allowed" },
      { path: ["credit_points"], sd: "allowed" },
      { path: ["grading_scheme"], sd: "allowed" },
      { path: ["nqf_level"], sd: "allowed" },
      { path: ["awarding_body_id"], sd: "allowed" },
      { path: ["awarding_body_country"], sd: "allowed" },
      { path: ["status"], sd: "never" },
    ],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["EDUCATION"],
      default_ttl_days: null,
      uses_status_list: true,
      min_issuer_assurance: "I2",
      min_binding_level: "T2",
      derived_claims: ["is_graduate", "graduated_before"],
      elm_profile: "ELM-3.3/Qualification",
      elm_mapping: {
        profile: "DC4EU EUHED (ELM 3.2)",
        claims: {
          family_name: "foaf:familyName",
          given_name: "foaf:givenName",
          birth_date: "elm:dateOfBirth",
          awarding_body_name: "elm:awardingBody/elm:legalName",
          awarding_body_id: "elm:awardingBody/elm:LegalIdentifier",
          awarding_body_country: "elm:location",
          qualification_title: "elm:LearningAchievement/dc:title",
          eqf_level: "elm:eqfLevel",
          nqf_level: "elm:nqfLevel",
          isced_f_code: "elm:educationSubject (ISCED-F)",
          awarding_date: "elm:AwardingProcess/elm:awardingDate",
          grade: "elm:gradeAchieved",
          thesis_title: "elm:additionalNote",
          credit_points: "elm:creditPoint (ECTS)",
          mode_of_study: "elm:mode",
        },
      },
      status: "ACTIVE",
    },
  },
};

/** ADR-0011 — Tamga geçici kimlik attestation'ı (PID değil; EAA). Devlet PID'i gelince süpersede edilir. TCKN seçici açıklamalı (K2). */
export const IDENTITY: SchemaDef = {
  vct: "urn:tamga:id:IdentityAttestation:1",
  path: "id/IdentityAttestation/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/id/IdentityAttestation/1.0.0/schema.json`,
    title: "TamgaIdentityAttestation",
    type: "object",
    required: [
      "iss",
      "vct",
      "vct#integrity",
      "iat",
      "exp",
      "cnf",
      "status",
      "family_name",
      "given_name",
      "birthdate",
      "nationalities",
      "personal_administrative_number",
      "document_type",
      "document_number_hash",
      "issuing_country",
      "document_chip_verified",
      "verification_method",
    ],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:id:IdentityAttestation:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      status: {
        type: "object",
        required: ["status_list"],
        properties: {
          status_list: {
            type: "object",
            required: ["idx", "uri"],
            properties: { idx: { type: "integer", minimum: 0 }, uri: { type: "string", format: "uri" } },
          },
        },
      },
      family_name: { type: "string", minLength: 1, maxLength: 200 },
      given_name: { type: "string", minLength: 1, maxLength: 200 },
      // ADR-0045: AB PID SD-JWT VC kodlaması (CIR 2026/1731 Tablo 7) — `birthdate`, `nationalities` (ISO 3166-1 alpha-2 dizisi;
      // bilinmiyorsa "QU", uyruksuz "QS")
      birthdate: DATE,
      nationalities: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: { type: "string", pattern: "^[A-Z]{2}$" },
      },
      personal_administrative_number: { type: "string", minLength: 5, maxLength: 32 },
      document_type: { enum: ["ID_CARD", "PASSPORT", "RESIDENCE_PERMIT", "DRIVING_LICENSE"] },
      document_number_hash: { type: "string", pattern: "^sha256-" },
      issuing_country: { type: "string", pattern: "^[A-Z]{2}$" },
      document_chip_verified: { type: "boolean" },
      // "review-demo": ADR-0033 mağaza incelemesi DEMO belgesi (yalnız DEMO imzacısı, I1; gerçek politikalarda geçmez)
      verification_method: {
        enum: ["remote-document-liveness-face", "remote-nfc-liveness-face", "in-person", "review-demo"],
      },
      age_over_18: { type: "boolean" },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Identity Attestation",
    description:
      "Identity attestation issued by the Tamga Identity Service after remote identity proofing (ADR-0011). Not a PID; it is superseded once a state-designated PID provider is available.",
    display: [
      {
        lang: "tr-TR",
        name: "Tamga Kimlik Belgesi",
        description: "Uzaktan kimlik doğrulamasıyla verilen kimlik attestation'ı",
      },
      {
        lang: "en-US",
        name: "Tamga Identity Attestation",
        description: "Identity attestation issued after remote identity proofing",
      },
    ],
    claims: [
      {
        path: ["family_name"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Soyad" },
          { lang: "en-US", label: "Family name" },
        ],
      },
      {
        path: ["given_name"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Ad" },
          { lang: "en-US", label: "Given name" },
        ],
      },
      {
        path: ["birthdate"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Doğum tarihi" },
          { lang: "en-US", label: "Date of birth" },
        ],
      },
      {
        path: ["nationalities"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Uyruk" },
          { lang: "en-US", label: "Nationality" },
        ],
      },
      // AB PID (CIR 2026/1731 §4.2; ARF PID_21): dizinin her öğesi ayrı ayrı açıklanır
      { path: ["nationalities", null], sd: "always" },
      {
        path: ["personal_administrative_number"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Kimlik numarası (TCKN)" },
          { lang: "en-US", label: "National ID number" },
        ],
      },
      { path: ["document_type"], sd: "always" },
      { path: ["document_number_hash"], sd: "always" },
      { path: ["issuing_country"], sd: "always" },
      {
        path: ["document_chip_verified"],
        sd: "always",
        display: [{ lang: "tr-TR", label: "Çip (NFC) ile doğrulandı" }],
      },
      { path: ["verification_method"], sd: "always", display: [{ lang: "tr-TR", label: "Doğrulama yöntemi" }] },
      { path: ["age_over_18"], sd: "always", display: [{ lang: "tr-TR", label: "18 yaş üstü" }] },
      { path: ["status"], sd: "never" },
    ],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["IDENTITY"],
      default_ttl_days: 730,
      uses_status_list: true,
      min_issuer_assurance: "I2", // ADR-0022: nitelikli olmayan EAA
      min_binding_level: "T2",
      derived_claims: ["age_over_18", "document_number_hash"],
      status: "ACTIVE",
      note: "ADR-0011 K2: the national ID number exists ONLY in this type and only selectively disclosable; no portrait; no holder LoA claim (document_chip_verified is a fact). ADR-0045: attribute names and encodings follow the EU PID encoding of Implementing Regulation (EU) 2026/1731 (SD-JWT VC: birthdate, nationalities[]; mdoc namespace tamga.id.1: birth_date as full-date, nationality as an array); age_over_18 is a Tamga attribute (not in the EU PID set) with the ISO/IEC 18013-5 name in both formats.",
    },
  },
};

/**
 * D10 — Etkinlik bileti (EAA). Kişisel veri YOK: bilet cihaz anahtarına bağlıdır (cnf), kimlik alanı taşımaz; devir = satıcıdan yeniden ihraç.
 * `gate`: cüzdanın kapı için geçiş kartı alacağı doğrulayıcı/terminal grubu (ADR-0012 B; tek kullanım K4). Status list: iptal + kapıda tüketim.
 */
export const TICKET: SchemaDef = {
  vct: "urn:tamga:tkt:EventTicket:1",
  path: "tkt/EventTicket/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/tkt/EventTicket/1.0.0/schema.json`,
    title: "TamgaEventTicket",
    type: "object",
    required: [
      "iss",
      "vct",
      "vct#integrity",
      "iat",
      "exp",
      "cnf",
      "status",
      "event_id",
      "event_name",
      "event_start",
      "event_end",
      "venue_name",
      "organizer_name",
      "ticket_class",
      "ticket_no_hash",
      "gate",
    ],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:tkt:EventTicket:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      category: { enum: ["urn:tamga:eaa:pub", "urn:tamga:eaa:qualified"] },
      status: {
        type: "object",
        required: ["status_list"],
        properties: {
          status_list: {
            type: "object",
            required: ["idx", "uri"],
            properties: { idx: { type: "integer", minimum: 0 }, uri: { type: "string", format: "uri" } },
          },
        },
      },
      event_id: { type: "string", minLength: 1, maxLength: 64 },
      event_name: { type: "string", minLength: 1, maxLength: 200 },
      event_start: { type: "string", format: "date-time" },
      event_end: { type: "string", format: "date-time" },
      venue_name: { type: "string", minLength: 1, maxLength: 200 },
      organizer_name: { type: "string", minLength: 1, maxLength: 200 },
      ticket_class: { type: "string", minLength: 1, maxLength: 64 }, // ör. STANDARD, VIP, STUDENT
      seat: { type: "string", maxLength: 32 },
      ticket_no_hash: { type: "string", pattern: "^sha256-" }, // satıcı bilet numarasının hash'i (opak; satıcı eşler)
      gate: {
        type: "object",
        required: ["terminal_group", "verifier_client_id"],
        properties: {
          terminal_group: { type: "string" },
          verifier_client_id: { type: "string" },
          policy_id: { type: "string" },
        },
      },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Event Ticket",
    description: "Event ticket — issued by the seller (ticketing company); device-bound, single use at the gate.",
    display: [
      { lang: "tr-TR", name: "Etkinlik Bileti", description: "Satıcının verdiği, cihaza bağlı bilet" },
      { lang: "en-US", name: "Event Ticket", description: "Device-bound event ticket issued by the seller" },
    ],
    claims: [
      { path: ["event_id"], sd: "always", display: [{ lang: "tr-TR", label: "Etkinlik kodu" }] },
      { path: ["event_name"], sd: "always", display: [{ lang: "tr-TR", label: "Etkinlik" }] },
      { path: ["event_start"], sd: "always", display: [{ lang: "tr-TR", label: "Başlangıç" }] },
      { path: ["event_end"], sd: "always", display: [{ lang: "tr-TR", label: "Bitiş" }] },
      { path: ["venue_name"], sd: "always", display: [{ lang: "tr-TR", label: "Mekân" }] },
      { path: ["organizer_name"], sd: "always", display: [{ lang: "tr-TR", label: "Organizatör" }] },
      { path: ["ticket_class"], sd: "always", display: [{ lang: "tr-TR", label: "Bilet sınıfı" }] },
      { path: ["seat"], sd: "always", display: [{ lang: "tr-TR", label: "Koltuk" }] },
      { path: ["ticket_no_hash"], sd: "always" },
      { path: ["gate"], sd: "never" },
      { path: ["status"], sd: "never" },
      { path: ["category"], sd: "never" },
    ],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["OTHER"],
      default_ttl_days: 400,
      uses_status_list: true,
      min_issuer_assurance: "I2",
      min_binding_level: "T0",
      derived_claims: ["ticket_no_hash"],
      status: "ACTIVE",
      note: "D10: no personal data; no identity required (T0). exp = event end + 1 day; upper bound 400 days (sales up to a year ahead). Single use at the gate: access pass single_use (ADR-0012 K4). Issuer category OTHER — the TICKETING category awaits DB-22 (ADR) approval.",
    },
  },
};

/** ADR-0021 — iletişim belgeleri (EAA, nitelikli değil): kod ile kanıtlanmış e-posta / telefon sahipliği. Kişi başına birden çok. */
const contactStatus = {
  type: "object",
  required: ["status_list"],
  properties: {
    status_list: {
      type: "object",
      required: ["idx", "uri"],
      properties: { idx: { type: "integer", minimum: 0 }, uri: { type: "string", format: "uri" } },
    },
  },
};
const contactTamga = (note: string) => ({
  tier: "NETWORK",
  issuer_categories: ["IDENTITY"],
  default_ttl_days: 365,
  uses_status_list: true,
  min_issuer_assurance: "I2",
  min_binding_level: "T0",
  derived_claims: [],
  status: "ACTIVE",
  note,
});

export const EMAIL: SchemaDef = {
  vct: "urn:tamga:contact:EmailAddress:1",
  path: "contact/EmailAddress/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/contact/EmailAddress/1.0.0/schema.json`,
    title: "TamgaEmailAddress",
    type: "object",
    required: ["iss", "vct", "vct#integrity", "iat", "exp", "cnf", "status", "email"],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:contact:EmailAddress:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      status: contactStatus,
      email: { type: "string", format: "email", minLength: 3, maxLength: 254 },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Verified Email Address",
    description:
      "Proves that the holder controlled this email address when the attestation was issued: a one-time code sent to the address was entered (ADR-0021). Short-lived; re-verified after expiry.",
    display: [
      { lang: "tr-TR", name: "E-posta adresi", description: "Kodla doğrulanmış e-posta adresi" },
      { lang: "en-US", name: "Email address", description: "Email address verified with a one-time code" },
    ],
    claims: [
      {
        path: ["email"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "E-posta" },
          { lang: "en-US", label: "Email" },
        ],
      },
      { path: ["status"], sd: "never" },
    ],
    tamga: contactTamga(
      "ADR-0021: ownership at issuance time only; no identity binding (T0). Disclosed only with the holder's consent; the address is a cross-site identifier.",
    ),
  },
};

export const PHONE: SchemaDef = {
  vct: "urn:tamga:contact:PhoneNumber:1",
  path: "contact/PhoneNumber/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/contact/PhoneNumber/1.0.0/schema.json`,
    title: "TamgaPhoneNumber",
    type: "object",
    required: ["iss", "vct", "vct#integrity", "iat", "exp", "cnf", "status", "phone_number"],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:contact:PhoneNumber:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      status: contactStatus,
      phone_number: { type: "string", pattern: "^[+][1-9][0-9]{6,14}$" },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Verified Phone Number",
    description:
      "Proves that the holder controlled this phone number (E.164) when the attestation was issued: a one-time code sent by SMS was entered (ADR-0021). Short-lived because numbers are reassigned.",
    display: [
      { lang: "tr-TR", name: "Telefon numarası", description: "SMS koduyla doğrulanmış telefon numarası" },
      { lang: "en-US", name: "Phone number", description: "Phone number verified with an SMS code" },
    ],
    claims: [
      {
        path: ["phone_number"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Telefon" },
          { lang: "en-US", label: "Phone" },
        ],
      },
      { path: ["status"], sd: "never" },
    ],
    tamga: contactTamga(
      "ADR-0021: ownership at issuance time only; numbers are reassigned, so validity is at most one year. No identity binding (T0).",
    ),
  },
};

/**
 * ADR-0031 K1 — site başına takma ad tohumu. Kimlik servisi kişinin değişmeyen kimliğinden ayrı anahtarla türetir (saklamaz);
 * yalnız cüzdan tutar, HİÇBİR ZAMAN sunulmaz (PS3): `tamga.presentable: false`; güven listesinde hiçbir RP kapsamına yazılamaz.
 * Cüzdan bundan her site için ayrı takma ad anahtarı türetir (K2). Status list yok: sunulmayan belgenin iptal biti anlamsızdır.
 */
export const PSEUDONYM_SEED: SchemaDef = {
  vct: "urn:tamga:id:PseudonymSeed:1",
  path: "id/PseudonymSeed/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/id/PseudonymSeed/1.0.0/schema.json`,
    title: "TamgaPseudonymSeed",
    type: "object",
    required: ["iss", "vct", "vct#integrity", "iat", "exp", "cnf", "pseudonym_seed"],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:id:PseudonymSeed:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      // 32 bayt, base64url (dolgusuz)
      pseudonym_seed: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Pseudonym Seed",
    description:
      "Wallet-only secret from which the wallet derives a separate, stable pseudonym key for each website (ADR-0031). Never presented to any relying party.",
    display: [
      { lang: "tr-TR", name: "Takma ad tohumu", description: "Yalnız cüzdanda kalır; hiçbir siteye gösterilmez" },
      { lang: "en-US", name: "Pseudonym seed", description: "Stays in the wallet; never shown to any site" },
    ],
    claims: [{ path: ["pseudonym_seed"], sd: "never" }],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["IDENTITY"],
      default_ttl_days: 730,
      uses_status_list: false,
      min_issuer_assurance: "I2",
      min_binding_level: "T2",
      derived_claims: ["pseudonym_seed"],
      presentable: false,
      status: "ACTIVE",
      note: "ADR-0031 PS2/PS3: derived per verification from the stable national identifier with a separate key, never stored by the identity service; never presented, never in any relying-party scope.",
    },
  },
};

/**
 * ADR-0039 — doğrulanmış sürücü belgesi bilgisi (EAA, nitelikli değil). Resmî sürücü belgesi DEĞİLDİR, mDL değildir (DL1):
 * kimlik servisi kartı uzaktan inceler (belge + canlılık + yüz) ve karttaki sınıfları/tarihleri verir. Kimlik numarası,
 * kısıtlama/sağlık kodu, fotoğraf, adres yok (DL2); belge numarası yalnız anahtarlı özet. Süre ≤ kart bitişi ve ≤ 1 yıl (DL3).
 * Yalnız SD-JWT VC. `not_official_licence` her zaman açık (sd: never) — her doğrulayıcı ibareyi görür.
 * Geliştirme evresi (ADR-0029): `driving_privileges` tek seçici alan (dizi bütünüyle açılır); sınıf başına açıklama sonra.
 */
export const DRIVING_LICENCE: SchemaDef = {
  vct: "urn:tamga:id:DrivingLicenceAttestation:1",
  path: "id/DrivingLicenceAttestation/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  extends: BASE.vct,
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/id/DrivingLicenceAttestation/1.0.0/schema.json`,
    title: "TamgaDrivingLicenceAttestation",
    type: "object",
    required: [
      "iss",
      "vct",
      "vct#integrity",
      "iat",
      "exp",
      "cnf",
      "status",
      "family_name",
      "given_name",
      "issuing_country",
      "document_number_hash",
      "driving_privileges",
      "licence_expiry_date",
      "verified_at",
      "verification_method",
      "not_official_licence",
    ],
    properties: {
      iss: { type: "string", format: "uri" },
      vct: { const: "urn:tamga:id:DrivingLicenceAttestation:1" },
      "vct#integrity": { type: "string", pattern: "^sha256-" },
      iat: { type: "integer" },
      exp: { type: "integer" },
      cnf: { type: "object" },
      status: contactStatus,
      family_name: { type: "string", minLength: 1, maxLength: 200 },
      given_name: { type: "string", minLength: 1, maxLength: 200 },
      birth_date: DATE,
      issuing_country: { type: "string", pattern: "^[A-Z]{2}$" },
      document_number_hash: { type: "string", pattern: "^sha256-" },
      // Karttaki sınıflar (AB 2006/126 kodları: AM, A1, A2, A, B1, B, BE, C1, C1E, C, CE, D1, D1E, D, DE; ulusal ekler F, G, M …)
      driving_privileges: {
        type: "array",
        minItems: 1,
        maxItems: 32,
        items: {
          type: "object",
          required: ["category"],
          properties: {
            category: { type: "string", pattern: "^[A-Z][A-Z0-9]{0,3}$" },
            issue_date: DATE,
            expiry_date: DATE,
          },
          additionalProperties: false,
        },
      },
      licence_issue_date: DATE,
      licence_expiry_date: DATE,
      verified_at: DATE,
      verification_method: { enum: ["remote-document-liveness-face"] },
      age_over_18: { type: "boolean" },
      // DL1: sabit ibare; şema değeri true'ya kilitler, metadata görünen metni taşır
      not_official_licence: { const: true },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Driving Licence Information",
    description:
      "Verified driving licence information (ADR-0039): the categories and validity printed on a physical driving licence card that the Tamga identity service inspected remotely (document + liveness + face match). NOT an official driving licence and NOT a mobile driving licence (mDL); not valid in traffic checks or official procedures.",
    display: [
      {
        lang: "tr-TR",
        name: "Sürücü belgesi bilgisi",
        description: "Resmî sürücü belgesi yerine geçmez · karttaki sınıflar ve geçerlilik, uzaktan doğrulanmış",
      },
      {
        lang: "en-US",
        name: "Driving licence information",
        description: "Not an official driving licence · categories and validity from the card, verified remotely",
      },
    ],
    claims: [
      {
        path: ["family_name"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Soyad" },
          { lang: "en-US", label: "Family name" },
        ],
      },
      {
        path: ["given_name"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Ad" },
          { lang: "en-US", label: "Given name" },
        ],
      },
      {
        path: ["birth_date"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Doğum tarihi" },
          { lang: "en-US", label: "Date of birth" },
        ],
      },
      {
        path: ["issuing_country"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Veren ülke" },
          { lang: "en-US", label: "Issuing country" },
        ],
      },
      { path: ["document_number_hash"], sd: "always" },
      {
        path: ["driving_privileges"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Sınıflar" },
          { lang: "en-US", label: "Categories" },
        ],
      },
      {
        path: ["licence_issue_date"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Kartın veriliş tarihi" },
          { lang: "en-US", label: "Card issue date" },
        ],
      },
      {
        path: ["licence_expiry_date"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Kartın geçerlilik sonu" },
          { lang: "en-US", label: "Card expiry date" },
        ],
      },
      {
        path: ["verified_at"],
        sd: "never",
        display: [
          { lang: "tr-TR", label: "Kartın incelendiği gün" },
          { lang: "en-US", label: "Card inspected on" },
        ],
      },
      {
        path: ["verification_method"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "Doğrulama yöntemi" },
          { lang: "en-US", label: "Verification method" },
        ],
      },
      {
        path: ["age_over_18"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "18 yaş üstü" },
          { lang: "en-US", label: "Over 18" },
        ],
      },
      {
        path: ["not_official_licence"],
        sd: "never",
        display: [
          { lang: "tr-TR", label: "Resmî sürücü belgesi yerine geçmez" },
          { lang: "en-US", label: "Not an official driving licence" },
        ],
      },
      { path: ["status"], sd: "never" },
    ],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["IDENTITY"],
      default_ttl_days: 365,
      uses_status_list: true,
      min_issuer_assurance: "I2",
      min_binding_level: "T2",
      derived_claims: ["document_number_hash", "age_over_18", "not_official_licence"],
      status: "ACTIVE",
      note: "ADR-0039 DL1–DL4: not the official mDL docType/namespace; no national ID number, restriction or health codes, photo or address; validity ≤ card expiry and ≤ 1 year from inspection; issuance for a country stops once its competent authority issues digital driving licences. Prerequisite: a Tamga identity credential presented at the PAR; name and date of birth must match the card.",
    },
  },
};

/**
 * ADR-0044 — ZK kopyası: kimlik belgesinin yalnız sıfır bilgi ispatlı sunumda (`mso_mdoc_zk`) kullanılan kısa ömürlü mdoc kopyası.
 * Ayırt edici işaret (K1) bu türdür: Longfellow ispatı docType'ı bağlar, doğrulayıcı ispattan türü görür. Tür kuralı (ZC1):
 * geçerlilik en çok 24 saat, iptal listesi yok (AB ARF VCR_01) — doğrulayıcı iptal denetimi beklemez (K5). Yalnız ZK ile sunulur;
 * öğeler yalnız ZK ile ispatlanabilenler (bugün `age_over_18`). Tür adı kamuya açık yeni addır — proje yönetiminin onayını bekler.
 */
export const ZK_COPY_VCT = "urn:tamga:id:ShortLivedIdentityAttestation:1";
/** ADR-0044 ZC1: ZK kopyasının azami geçerliliği (sn) — AB ARF VCR_01 eşiği. */
export const ZK_COPY_MAX_VALIDITY_SEC = 24 * 3600;
export const ZK_COPY: SchemaDef = {
  vct: ZK_COPY_VCT,
  path: "id/ShortLivedIdentityAttestation/1.0.0",
  metadataVersion: "1.0.0",
  layer: "NETWORK",
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${CATALOGUE_BASE}/id/ShortLivedIdentityAttestation/1.0.0/schema.json`,
    title: "TamgaShortLivedIdentityAttestation",
    description:
      "ISO/IEC 18013-5 mdoc only (docType = vct, namespace tamga.id.1). Elements of the ZK copy; the validity (validFrom → validUntil) is at most 24 hours and the MSO carries no status.",
    type: "object",
    required: ["age_over_18"],
    properties: {
      age_over_18: { type: "boolean" },
      // cihaz bağlaması (mdoc deviceKey; doğrulayıcının B6 örneğinde `cnf` olarak durur)
      cnf: { type: "object" },
    },
    additionalProperties: false,
  },
  typeMetadata: {
    name: "Tamga Identity Attestation — short-lived copy",
    description:
      "Short-lived technical copy of the Tamga identity attestation, presented only with a zero-knowledge proof (ADR-0044). Valid for at most 24 hours; carries no revocation list entry — short validity replaces revocation (EU ARF VCR_01). Not issued once the main identity attestation is revoked or suspended.",
    display: [
      {
        lang: "tr-TR",
        name: "Tamga Kimlik Belgesi — kısa ömürlü kopya",
        description: "Yalnız sıfır bilgi ispatıyla gösterilen, en çok 24 saat geçerli teknik kopya",
      },
      {
        lang: "en-US",
        name: "Tamga Identity Attestation — short-lived copy",
        description: "Technical copy shown only with a zero-knowledge proof, valid for at most 24 hours",
      },
    ],
    claims: [
      {
        path: ["age_over_18"],
        sd: "always",
        display: [
          { lang: "tr-TR", label: "18 yaş üstü" },
          { lang: "en-US", label: "Over 18" },
        ],
      },
    ],
    tamga: {
      tier: "NETWORK",
      issuer_categories: ["IDENTITY"],
      default_ttl_days: null,
      max_validity_sec: ZK_COPY_MAX_VALIDITY_SEC,
      uses_status_list: false,
      formats: ["mso_mdoc"],
      presentation: ["mso_mdoc_zk"],
      mdoc_namespace: "tamga.id.1",
      copy_of: IDENTITY.vct,
      min_issuer_assurance: "I2",
      min_binding_level: "T2",
      status: "ACTIVE",
      note: "ADR-0044 ZC1–ZC4: issued only by the identity service, in small batches refreshed silently with a DPoP- and WIA-bound refresh token; validity ≤ 24 h, no status; presented only as mso_mdoc_zk. The verifier treats a ZK presentation of this type as short-lived (status NOT_APPLICABLE) without accept_unrevocable_zk.",
    },
  },
};

export const ALL: SchemaDef[] = [
  BASE,
  STUDENT,
  DIPLOMA,
  IDENTITY,
  TICKET,
  EMAIL,
  PHONE,
  PSEUDONYM_SEED,
  DRIVING_LICENCE,
  ZK_COPY,
];

/**
 * ADR-0044 K5: tür kuralı gereği kısa ömürlü mü (en çok 24 saat geçerli, iptal listesi yok — AB ARF VCR_01)? Doğrulayıcı bu türün
 * ZK sunumunda iptal denetimi beklemez. Katalogda olmayan tür `false`.
 */
export function isShortLivedType(vct: string): boolean {
  const t = ALL.find((d) => d.vct === vct)?.typeMetadata.tamga as
    { max_validity_sec?: number; uses_status_list?: boolean } | undefined;
  return (
    !!t &&
    t.uses_status_list === false &&
    typeof t.max_validity_sec === "number" &&
    t.max_validity_sec <= ZK_COPY_MAX_VALIDITY_SEC
  );
}

/** ADR-0031 PS3: sunulamayan türler (cüzdan sunum ekranında listelemez, güven listesi kapsama yazdırmaz). */
export const NON_PRESENTABLE_VCTS: readonly string[] = ALL.filter(
  (d) => (d.typeMetadata.tamga as { presentable?: boolean } | undefined)?.presentable === false,
).map((d) => d.vct);
