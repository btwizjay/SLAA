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
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
