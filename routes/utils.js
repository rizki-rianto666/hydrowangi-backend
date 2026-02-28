const Planted = require("../models/Planted");

let lastPPMStatus = "normal";
let lastEmailSentAt = 0;
const EMAIL_COOLDOWN = 1000 * 60 * 30;

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // app password, bukan password asli
  },
});

export async function checkAndSendPPMAlert(ppm) {
  const planted = await Planted.findOne().populate("plant").lean();

  let batasMin = 600;
  let batasMax = 1200;

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
        from: process.env.EMAIL_USER,
        to: "delonexton@gmail.com",
        subject: "⚠️ ALERT PPM HIDROPONIK",
        text: `PPM ${ppm} berada di luar batas (${batasMin}-${batasMax})`,
      });

      lastEmailSentAt = now;
    }

    lastPPMStatus = "danger";
  }

  if (!isDanger) {
    lastPPMStatus = "normal";
  }
}