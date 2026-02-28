const Planted = require("../models/Planted");
const nodemailer = require("nodemailer");

let lastPPMStatus = "normal";
let lastEmailSentAt = 0;
const EMAIL_COOLDOWN = 1000 * 60 * 30;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function checkAndSendPPMAlert(ppm) {
  const planted = await Planted.findOne().populate("plant").lean();

  // Nilai default jika data tanaman tidak ditemukan
  let batasMin = 0;
  let batasMax = Infinity;

  if (planted?.plant?.tds) {
    const targetTDS = planted.plant.tds;
    batasMin = targetTDS - 200;
    batasMax = targetTDS + 200;
  }

  const isDanger = ppm < batasMin || ppm > batasMax;
  console.log("targetTDS:", planted?.plant?.tds);
  console.log("batasMin:", batasMin, "batasMax:", batasMax);
  console.log("isDanger:", isDanger);
  console.log("lastPPMStatus:", lastPPMStatus);

  if (isDanger && lastPPMStatus === "normal") {
    const now = Date.now();

    if (now - lastEmailSentAt > EMAIL_COOLDOWN) {
      await transporter.sendMail({
        from: `"Sistem Monitoring Hidroponik 🌱" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: "Peringatan Nilai PPM Tanaman",
        html: `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
    <div style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.08);">
      <h2 style="color:#d32f2f; margin-top:0;">⚠️ Peringatan Kualitas Nutrisi</h2>
      <p style="font-size:14px; color:#444;">
        Halo, Ibu 🌱<br><br>
        Sistem mendeteksi bahwa nilai nutrisi (PPM) pada tanaman saat ini berada di luar batas normal.
      </p>
      <div style="background:#fff3f3; padding:15px; border-radius:8px; margin:15px 0;">
        <p style="margin:5px 0; font-size:14px;"><strong>Nilai PPM Saat Ini:</strong></p>
        <h1 style="margin:0; color:#d32f2f;">${ppm} ppm</h1>
      </div>
      <p style="font-size:14px;">
        Batas normal tanaman:<br>
        <strong>${batasMin} - ${batasMax} ppm</strong>
      </p>
      <p style="font-size:14px; color:#444;">
        Mohon segera periksa larutan nutrisi agar tanaman tetap sehat dan tumbuh dengan baik.
      </p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
      <p style="font-size:12px; color:#777;">Waktu pengecekan: ${new Date().toLocaleString()}</p>
      <p style="font-size:12px; color:#999;">Pesan ini dikirim otomatis oleh Sistem Monitoring Hidroponik 🌱</p>
    </div>
  </div>
        `,
      });

      lastEmailSentAt = now;
    }

    lastPPMStatus = "danger";
  }

  if (!isDanger) {
    lastPPMStatus = "normal";
  }
}

module.exports = { checkAndSendPPMAlert };