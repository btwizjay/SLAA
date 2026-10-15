/**
 * QR code PNG for the meet-day posters.
 *   npx tsx scripts/make_qr.ts https://register.example.lk [out.png]
 */
import QRCode from "qrcode";

const url = process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL;
const out = process.argv[3] ?? "slaa-register-qr.png";
if (!url || !/^https:\/\//.test(url)) {
  console.error("usage: tsx scripts/make_qr.ts https://<live site> [out.png]");
  process.exit(1);
}

QRCode.toFile(out, url, { width: 1200, margin: 4, errorCorrectionLevel: "H" }).then(() =>
  console.log(`wrote ${out} for ${url}`),
);
