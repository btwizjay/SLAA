// English: the source language. Every key here must exist in si.ts and ta.ts
// (TypeScript enforces it). Use {name} for values filled in at runtime.

export const en = {
  siteTitle: "National Register",
  footer: "Sri Lanka Athletics Association. Your NIC, phone and email are never shown publicly.",
  language: "Language",
  changeLanguage: "Change language",

  homeTitle: "Get your SLAA ID",
  homeIntro:
    "One ID for life for every athlete in Sri Lankan athletics. It takes about five minutes. " +
    "Have your NIC or Postal ID ready.",
  homeAthleteTitle: "Register as an Athlete",
  homeAthleteText: "You compete in athletics. You can link your current and past coaches.",
  homeAlreadyTitle: "Already registered?",
  homeAlreadyText:
    "Each person can register only once. If you start again with the same ID, we will show you your " +
    "existing SLAA ID instead.",

  stepCheck: "Step 1 of 2 · Athlete registration",
  checkTitle: "Check your ID",
  checkIntro: "We first check that you are not already registered. Each person gets one SLAA ID for life.",
  continue: "Continue",
  checking: "Checking…",
  whichId: "Which ID will you use?",
  idNic: "NIC",
  idPostal: "Postal ID",
  nicNumber: "NIC number",
  nicHint: "Old format: 9 digits and V or X (e.g. 853202937V). New format: 12 digits.",
  nicDecoded: "From this NIC: born {dob}, {gender}. Please check this is correct.",
  genderMaleLower: "male",
  genderFemaleLower: "female",
  postalNumber: "Postal ID number",
  alreadyTitle: "You are already registered",
  alreadyYourId: "Your SLAA ID is",
  alreadyText:
    "You do not need to register again. If any of your details are wrong, or this is not you, please " +
    "contact SLAA to update your record.",
  backToStart: "Back to start",
  change: "Change",

  stepForm: "Step 2 of 2 · Athlete registration",
  formTitle: "Your details",
  loading: "Loading…",
  aboutYou: "About you",
  fullName: "Full name",
  fullNameHint: "As on your NIC or Postal ID",
  nameWithInitials: "Name with initials",
  nameWithInitialsHint: "e.g. K. P. Perera",
  dateOfBirth: "Date of birth",
  fromNic: "Taken from your NIC",
  gender: "Gender",
  select: "Select",
  male: "Male",
  female: "Female",
  district: "District",
  selectDistrict: "Select district",
  phoneAthlete: "Mobile number (athlete or guardian)",
  phoneHint: "e.g. 077 123 4567",
  schoolOrClub: "School or club",
  mainEvents: "Main events",
  optional: "(optional)",

  guardianTitle: "Parent or guardian",
  guardianDesc: "Required because the athlete is under 18.",
  guardianName: "Guardian's full name",
  guardianRel: "Relationship to athlete",
  guardianRelHint: "e.g. Mother, Father, Legal guardian",
  guardianPhone: "Guardian's mobile number",
  guardianNic: "Guardian's NIC",

  coachesTitle: "Your coaches",
  coachesDesc: "Add your current coach and any past coaches. Each coach will be asked to confirm.",
  remove: "Remove",
  relationship: "Relationship",
  currentCoach: "Current coach",
  pastCoach: "Past coach",
  fromYear: "From year",
  toYear: "To year",
  primaryCoach: "Main (primary) coach",
  searchCoaches: "Search coaches",
  searchHint: "Type at least 2 letters of the name, or the SLAA ID",
  searchPlaceholder: "e.g. Perera",
  filterDistrict: "Filter by district",
  allDistricts: "All districts",
  searching: "Searching…",
  noCoach: "No coach found. If your coach is not in the list, you can leave this section empty.",
  searchFailed: "Search failed. Please try again.",
  searchNetwork: "Search failed. Check your connection.",

  consentSection: "Consent",
  consentTitle: "Consent to use your personal data",
  consentBody:
    "Sri Lanka Athletics Association (SLAA) will store the details on this form, including your " +
    "identity number, date of birth and contact details, to issue and maintain your SLAA ID, to " +
    "verify eligibility for competitions, and to contact you about SLAA athletics programmes. " +
    "Your NIC, phone number and email are never shown publicly. You may ask SLAA to see or correct " +
    "your details at any time. This is processed under the Personal Data Protection Act, No. 9 of 2022.",
  consentCheckbox: "I have read the above and agree to SLAA storing and using my details for these purposes.",
  guardianConsentCheckbox:
    "As the parent or legal guardian, I agree to SLAA storing and using this athlete's details for these purposes.",
  submit: "Register and get my SLAA ID",
  submitting: "Registering…",
  securityNotLoaded: "The security check did not load. Check your connection and refresh the page.",
  serverError: "Something went wrong. Please try again.",
  networkError: "Could not reach the server. Check your connection and try again.",

  doneTitle: "You are registered",
  doneKeep: "Keep your SLAA ID safe. You will use it for every meet.",
  cardOrg: "Sri Lanka Athletics",
  cardAthlete: "Athlete",
  cardSlaaId: "SLAA ID",
  cardStatus: "Status: pending verification by SLAA",
  copyId: "Copy ID",
  copied: "Copied",
  printCard: "Print card",
  nextTitle: "What happens next",
  next1: "Take a screenshot of this page or write down your SLAA ID.",
  next2: "SLAA staff will verify your details. You do not need to do anything.",
  next3: "The coaches you listed must confirm the link. Until then it shows as pending.",
  nothingTitle: "Nothing to show",
  nothingText: "Start a registration from the home page.",
  goToStart: "Go to start",

  // -------------------------------------------------------------------------
  // Home page — coach option
  // -------------------------------------------------------------------------
  homeCoachTitle: "Register as a Coach",
  homeCoachText:
    "You coach athletes in Sri Lankan athletics. You will receive a SLAA coach ID and a CECS registration.",

  // -------------------------------------------------------------------------
  // Identity check — coach variant
  // -------------------------------------------------------------------------
  stepCheckCoach: "Step 1 of 2 · Coach registration",

  // -------------------------------------------------------------------------
  // Coach form — top-level
  // -------------------------------------------------------------------------
  stepFormCoach: "Step 2 of 2 · Coach registration",
  coachFormTitle: "Coach registration",
  coachStepPersonal: "Personal details",
  coachStepQuals: "Qualifications",
  coachStepAthletes: "Athletes",
  coachStepDeclarations: "Declarations",
  coachStep: "Step {n} of 4",
  coachBackBtn: "Back",
  coachNextBtn: "Next",

  // -------------------------------------------------------------------------
  // Step 1 — Personal & professional details
  // -------------------------------------------------------------------------
  coachPersonalTitle: "Personal & professional details",
  coachPersonalDesc: "These details will appear on your SLAA coach record.",
  phoneCoach: "Mobile number",
  email: "Email address",
  slaaLicenseNo: "SLAA licence number",
  slaaLicenseNoHint: "Leave blank if you do not have one.",
  disciplinesCoach: "Events you coach",
  disciplinesCoachDesc:
    "Select all events that you currently coach. At least one is required.",

  // -------------------------------------------------------------------------
  // Step 2 — Qualifications
  // -------------------------------------------------------------------------
  coachQualsTitle: "Coaching qualifications",
  coachQualsDesc:
    "Add every coaching qualification you hold. At least one is required. " +
    "Upload the certificate for each — PDF, JPG or PNG, max 5 MB.",
  coachQualLevel: "Qualification level",
  coachQualLevelOther: "Describe the qualification",
  coachQualEventGroup: "Event group",
  coachQualIssuingBody: "Issuing body",
  coachQualSerial: "Certificate serial / reference number",
  coachQualYear: "Year awarded",
  coachQualUpload: "Upload certificate",
  coachQualUploadHint: "PDF, JPG or PNG, max 5 MB.",
  coachQualUploading: "Uploading…",
  coachQualUploaded: "Uploaded",
  coachQualUploadRetry: "Retry upload",
  coachQualUploadFailed: "Upload failed.",
  coachQualAdd: "Add another qualification",
  coachQualRemove: "Remove",
  coachQualSelectGroup: "Select event group",
  coachQualSelectBody: "Select or type issuing body",

  // -------------------------------------------------------------------------
  // Step 3 — Athletes (optional)
  // -------------------------------------------------------------------------
  coachAthletesTitle: "Athletes you coach",
  coachAthletesDesc:
    "Search for athletes already registered with SLAA and add them to your record. " +
    "Each athlete will be able to confirm the link from their profile.",
  coachAthletesOptional: "This step is optional — you can skip it and add athletes later.",
  searchAthletes: "Search athletes",
  searchAthletesHint: "Type at least 2 letters of the name, or the SLAA ID",
  searchAthletesPlaceholder: "e.g. Perera",
  noAthlete: "No athlete found. They may not be registered yet.",
  searchAthletesFailed: "Search failed. Please try again.",
  coachAthletesSkip: "Skip this step",

  // -------------------------------------------------------------------------
  // Step 4 — CECS Declarations
  // -------------------------------------------------------------------------
  coachDeclTitle: "CECS declarations",
  coachDeclDesc:
    "Read each declaration carefully and check the box to confirm, or choose " +
    "\"I need to disclose\" where shown. All declarations are required.",
  coachDeclSectionCert: "Certification and accreditation",
  coachDeclSectionSafe: "Safeguarding and child protection",
  coachDeclSectionInt: "Anti-doping and sports integrity",
  coachDeclSectionAth: "Athletes and transfers",
  coachDeclSectionLegal: "Legal, privacy and data accuracy",
  coachDeclConfirm: "I confirm",
  coachDeclDisclose: "I need to disclose something",
  coachDeclDiscloseLabel: "Disclosure details",
  coachDeclDisclosePlaceholder:
    "Please describe the matter you need to disclose. SLAA will review this confidentially.",
  coachDeclDisclosureNote:
    "A disclosure does not automatically block registration. SLAA will review it confidentially.",
  coachSignatureTitle: "Digital signature",
  coachSignatureDesc:
    "Type your full name exactly as entered in Step 1 to confirm all declarations.",
  coachSignatureLabel: "Full name (as signature)",
  coachSignatureMismatch: "The name does not match the full name you entered in Step 1.",
  coachSubmit: "Submit registration",
  coachSubmitting: "Submitting…",
  coachConsentLabel:
    "I have read the above declarations and agree to SLAA storing and using my details for coaching accreditation purposes.",

  // -------------------------------------------------------------------------
  // Done page — coach variant
  // -------------------------------------------------------------------------
  coachDoneTitle: "You are registered as a coach",
  coachDoneKeep: "Keep your SLAA coach ID safe. It identifies you in every competition and accreditation process.",
  cardCoach: "Coach",
  coachCardStatus: "Status: registered — pending SLAA verification",
  coachNextTitle: "What happens next",
  coachNext1: "Screenshot or note your SLAA coach ID.",
  coachNext2: "SLAA will verify your qualifications and declarations. You do not need to do anything.",
  coachNext3: "If you disclosed anything, SLAA will contact you confidentially.",
  coachNext4: 'Once verified, your status changes to "verified".',
  coachUploadRetryTitle: "Certificate upload pending",
  coachUploadRetryText:
    "Your registration was saved, but one or more certificates could not be uploaded. " +
    "You can retry the upload below. Your registration is complete — the upload is optional for now.",
  coachUploadRetryBtn: "Retry uploading certificate",
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
