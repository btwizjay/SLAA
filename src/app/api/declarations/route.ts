import { NextResponse } from "next/server";
import { sqlCoach } from "@/lib/db";

type DeclarationItem = {
  code: string;
  version: number;
  section: "certification" | "safeguarding" | "integrity" | "athletes" | "legal";
  title: string;
  text_en: string;
  text_si?: string | null;
  text_ta?: string | null;
  allows_disclosure: boolean;
  required: boolean;
  active: boolean;
};

// 13 base declarations as defined in slaa_schema.sql (CECS guidelines)
const DEFAULT_DECLARATIONS: DeclarationItem[] = [
  {
    code: "CERT_LEVEL",
    version: 1,
    section: "certification",
    title: "Highest qualification",
    text_en:
      "I confirm that the qualifications I have listed, including level, issuing body, year awarded and certificate number, are my own and are accurate.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "DOC_AUTHENTIC",
    version: 1,
    section: "certification",
    title: "Genuine documents",
    text_en:
      "I confirm that every certificate, transcript and licence I upload is a genuine, unaltered copy of the original.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "NO_CONVICTIONS",
    version: 1,
    section: "safeguarding",
    title: "Criminal record",
    text_en:
      'I confirm that I have no criminal convictions, and no pending investigations or charges, relating to sexual offences, exploitation, child abuse or neglect, or violence. If this is not true for me, I will choose "I need to disclose" and give details.',
    allows_disclosure: true,
    required: true,
    active: true,
  },
  {
    code: "POLICE_CLEARANCE",
    version: 1,
    section: "safeguarding",
    title: "Police clearance",
    text_en:
      "I agree to provide a current Police Clearance Certificate when SLAA requests it, and to tell SLAA within 14 days if I am charged with or convicted of any offence.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "SAFEGUARDING_CODE",
    version: 1,
    section: "safeguarding",
    title: "Safeguarding code of conduct",
    text_en:
      "I agree to follow the SLAA safeguarding code of conduct: keep appropriate physical and communication boundaries with athletes, never be alone in private with a minor where avoidable, keep a parent or guardian included in messages to athletes under 18, ensure a safe training environment, and report any concern about abuse to the SLAA safeguarding officer.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "NO_DOPING_SANCTION",
    version: 1,
    section: "integrity",
    title: "Anti-doping record",
    text_en:
      'I confirm that I am not currently serving a sanction or provisional suspension under the World Anti-Doping Code, from the Sri Lanka Anti-Doping Agency (SLADA), the Athletics Integrity Unit (AIU) or any sport body. If this is not true for me, I will choose "I need to disclose" and give details.',
    allows_disclosure: true,
    required: true,
    active: true,
  },
  {
    code: "CLEAN_SPORT",
    version: 1,
    section: "integrity",
    title: "Commitment to clean sport",
    text_en:
      "I will not administer, supply, traffic, encourage or help hide the use of any prohibited substance or method, and I will support my athletes to meet their anti-doping obligations.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "NO_MANIPULATION",
    version: 1,
    section: "integrity",
    title: "Competition manipulation",
    text_en:
      "I will not take part in fixing or manipulating any competition, betting on athletics events involving my athletes, or sharing inside information for betting.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "ATHLETE_ROSTER",
    version: 1,
    section: "athletes",
    title: "Athletes I coach",
    text_en:
      "I confirm that every athlete I list as current is actively training under my supervision, and that the coaching periods I give for past athletes are accurate.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "TRANSFER_RULES",
    version: 1,
    section: "athletes",
    title: "Athlete transfers",
    text_en:
      "I confirm that, to my knowledge, athletes who moved to or from me did so in line with SLAA transfer rules and without an unresolved dispute.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "TRUE_INFORMATION",
    version: 1,
    section: "legal",
    title: "Truth of information",
    text_en:
      "I confirm that all information in this application is true, complete and accurate. I understand that false information or credentials will lead to disciplinary action and revocation of my registration or accreditation.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "DATA_CONSENT",
    version: 1,
    section: "legal",
    title: "Use of my data",
    text_en:
      "I consent to SLAA storing and processing my personal and professional details in the national athletics database, and sharing them with World Athletics where needed for accreditation, in line with the Personal Data Protection Act No. 9 of 2022.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
  {
    code: "VERIFY_CONSENT",
    version: 1,
    section: "legal",
    title: "Verification checks",
    text_en:
      "I allow SLAA to check my credentials with the bodies that issued them, my past clubs and schools, World Athletics, SLADA and the AIU.",
    allows_disclosure: false,
    required: true,
    active: true,
  },
];

export async function GET() {
  try {
    const rows = await sqlCoach<DeclarationItem[]>`
      SELECT code, version, section, title, text_en, text_si, text_ta,
             allows_disclosure, required, active
      FROM declaration_text
      WHERE active = true
      ORDER BY CASE section
        WHEN 'certification' THEN 1
        WHEN 'safeguarding' THEN 2
        WHEN 'integrity' THEN 3
        WHEN 'athletes' THEN 4
        WHEN 'legal' THEN 5
        ELSE 6
      END, code`;

    if (rows && rows.length > 0) {
      return NextResponse.json(rows);
    }
  } catch (e) {
    console.warn("Could not load declarations from DB, using defaults:", e);
  }

  return NextResponse.json(DEFAULT_DECLARATIONS);
}

