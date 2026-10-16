export type ImportState = {
  error?: string;
  success?: string;
  token?: string;
  rows?: {
    line: number;
    name: string;
    identityType: string;
    action: string;
    existingId: string | null;
    existingName: string | null;
  }[];
};
