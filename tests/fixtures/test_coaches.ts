/**
 * Test fixtures for SLAA Coach Registration test suite.
 */

export const DECLARATION_CODES = [
  "CERT_LEVEL",
  "DOC_AUTHENTIC",
  "NO_CONVICTIONS",
  "POLICE_CLEARANCE",
  "SAFEGUARDING_CODE",
  "NO_DOPING_SANCTION",
  "CLEAN_SPORT",
  "NO_MANIPULATION",
  "ATHLETE_ROSTER",
  "TRANSFER_RULES",
  "TRUE_INFORMATION",
  "DATA_CONSENT",
  "VERIFY_CONSENT",
] as const;

export function buildDeclarations(overrides: Record<string, { answer: "confirm" | "disclose"; disclosureDetails?: string }> = {}) {
  return DECLARATION_CODES.map((code) => {
    const override = overrides[code];
    return {
      code,
      version: 1,
      answer: override ? override.answer : "confirm",
      disclosureDetails: override?.disclosureDetails ?? "",
    };
  });
}

export const testCoachCases = {
  // Case A: Fresh Valid Registration (Happy Path)
  caseA: {
    name: "Case A: Fresh Valid Registration (Happy Path)",
    identity: {
      type: "nic" as const,
      nic: "199214501234", // Decoded: 1992-05-24, Male
    },
    form: {
      fullName: "Nuwan Chamara Bandara",
      nameWithInitials: "N. C. Bandara",
      dateOfBirth: "1992-05-24",
      gender: "M" as const,
      district: "Colombo" as const,
      phone: "0712345678",
      email: "nuwan.bandara@example.com",
      licenseNo: "SLAA-C-2023-88",
      disciplines: ["100m", "200m", "400m"],
      qualifications: [
        {
          level: "CECS_L2_EVENT" as const,
          eventGroup: "Sprints",
          issuingBody: "World Athletics",
          certificateSerial: "WA-2023-8891",
          yearAwarded: 2023,
          _uploadedPath: "provisional/sample-cert.pdf",
        },
      ],
      athletes: [
        {
          athleteId: "A26-000101-1",
          relationship: "CURRENT" as const,
          startYear: 2023,
          endYear: "" as const,
          isPrimary: true,
        },
      ],
      declarations: buildDeclarations(),
      signature: "Nuwan Chamara Bandara",
      consent: true as const,
    },
    turnstileToken: "1x00000000000000000000AA",
    expected: {
      checkStatus: 200,
      exists: false,
      submitStatus: 201,
      reviewStatus: "not_needed",
    },
  },

  // Case B: Disclosure Path (Safeguarding Flag)
  caseB: {
    name: "Case B: Disclosure Path (Safeguarding Flag)",
    identity: {
      type: "nic" as const,
      nic: "198822003456", // Decoded: 1988-08-07, Male
    },
    form: {
      fullName: "Dinesh Priyantha Rathnayake",
      nameWithInitials: "D. P. Rathnayake",
      dateOfBirth: "1988-08-07",
      gender: "M" as const,
      district: "Kandy" as const,
      phone: "0777654321",
      email: "dinesh.rathnayake@example.com",
      licenseNo: "SLAA-C-2019-12",
      disciplines: ["JT", "SP"],
      qualifications: [
        {
          level: "CECS_L3_ELITE" as const,
          eventGroup: "Throws",
          issuingBody: "World Athletics",
          certificateSerial: "WA-CECS-2019-771",
          yearAwarded: 2019,
          _uploadedPath: "provisional/dinesh-l3.pdf",
        },
      ],
      athletes: [],
      declarations: buildDeclarations({
        NO_CONVICTIONS: {
          answer: "disclose",
          disclosureDetails: "Pending traffic dispute inquiry from 2024",
        },
      }),
      signature: "Dinesh Priyantha Rathnayake",
      consent: true as const,
    },
    turnstileToken: "1x00000000000000000000AA",
    expected: {
      checkStatus: 200,
      exists: false,
      submitStatus: 201,
      reviewStatus: "pending",
    },
  },

  // Case C: Duplicate NIC Test
  caseC: {
    name: "Case C: Duplicate NIC Test",
    identity: {
      type: "nic" as const,
      nic: "853202937V", // Matches pre-existing coach 198532002937
    },
    turnstileToken: "1x00000000000000000000AA",
    expected: {
      checkStatus: 200,
      exists: true,
      slaaIdPrefix: "C",
      maskedName: "K. P",
    },
  },

  // Case D: Mismatched Signature / Incomplete Declarations
  caseD: {
    name: "Case D: Mismatched Signature / Incomplete Declarations",
    identity: {
      type: "nic" as const,
      nic: "199411004321", // Decoded: 1994-04-20, Male
    },
    form: {
      fullName: "Kasun Kalhara Jayasuriya",
      nameWithInitials: "K. K. Jayasuriya",
      dateOfBirth: "1994-04-20",
      gender: "M" as const,
      district: "Kurunegala" as const,
      phone: "0789012345",
      email: "kasun.j@example.com",
      licenseNo: "",
      disciplines: ["LJ"],
      qualifications: [
        {
          level: "CECS_L1_YOUTH" as const,
          eventGroup: "Jumps",
          issuingBody: "SLAA",
          certificateSerial: "SLAA-2022-441",
          yearAwarded: 2022,
        },
      ],
      athletes: [],
      declarations: buildDeclarations(),
      // Intentionally mismatched signature (doesn't match Kasun Kalhara Jayasuriya)
      signature: "Totally Different Name",
      consent: true as const,
    },
    turnstileToken: "1x00000000000000000000AA",
    expected: {
      submitStatus: 400,
      errorMessage: "Digital signature does not match your full name.",
    },
  },

  // Case E: Rejection of Postal ID for Coach Registration
  caseE: {
    name: "Case E: Rejection of Postal ID for Coach Registration",
    identity: {
      type: "postal" as const,
      postalId: "12345678",
    },
    form: {
      fullName: "Test Postal Coach",
      nameWithInitials: "T. P. Coach",
      dateOfBirth: "1990-01-01",
      gender: "M" as const,
      district: "Colombo" as const,
      phone: "0771234567",
      email: "",
      licenseNo: "",
      disciplines: ["100m"],
      qualifications: [
        {
          level: "CECS_L1_YOUTH" as const,
          eventGroup: "Sprints",
          issuingBody: "World Athletics",
          certificateSerial: "WA-2020-001",
          yearAwarded: 2020,
        },
      ],
      athletes: [],
      declarations: buildDeclarations(),
      signature: "Test Postal Coach",
      consent: true as const,
    },
    turnstileToken: "1x00000000000000000000AA",
    expected: {
      submitStatus: 400,
    },
  },
};

