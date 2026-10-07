// backend/index.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config({ path: __dirname + "/.env" });

const app = express();
app.use(bodyParser.json({limit: '25mb'}));
app.use(cors());

// Init Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("Supabase environment variables missing!");
    process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Serve schemas from backend/schemas as JSON
app.get("/schemas", (req, res) => {
    // optional ?form=new_contractor to get single
    const formName = req.query.form;
    const schemasDir = path.join(__dirname, "schemas");
    try {
        if (formName) {
            const file = path.join(schemasDir, `${formName}.json`);
            if (!fs.existsSync(file)) return res.status(404).json({error: "Schema not found"});
            const json = JSON.parse(fs.readFileSync(file, "utf8"));
            return res.json(json);
        }
        const files = fs.readdirSync(schemasDir).filter(f => f.endsWith(".json"));
        const list = files.map(f => {
            const json = JSON.parse(fs.readFileSync(path.join(schemasDir, f), "utf8"));
            return { form_type: json.form_type, title: json.title, description: json.description || "" };
        });
        res.json(list);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to read schemas" });
    }
});

// Submit endpoint: accepts { form_type, form_data, user_id, lang, pdf_base64? }
app.post("/submit", async (req, res) => {
    const { form_type, form_data, user_id, lang, pdf_base64 } = req.body;
    if (!form_type || !form_data) return res.status(400).json({ message: "Missing form_type or form_data" });

    try {
        // load schema to get ordered labels
        const schemaPath = path.join(__dirname, "schemas", `${form_type}.json`);
        if (!fs.existsSync(schemaPath)) {
            return res.status(400).json({ message: "Unknown form type" });
        }
        const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

        // 1) Generate PDF
        const timestamp = Date.now();
        const fileName = `${form_type}_${timestamp}_${(form_data.fullname||form_data.candidate_name||form_data.applicant_name||form_data.b1_full_name||"user").replace(/\s+/g,'_')}.pdf`;
        const pdfPath = path.join(__dirname, fileName);

        // Preferred: PDF rendered in the browser from the filled form page (exact on-screen copy).
        // Fallback: plain table PDF generated with pdfkit.
        let pdfBuffer;
        if (typeof pdf_base64 === "string" && pdf_base64.length > 0) {
            pdfBuffer = Buffer.from(pdf_base64.replace(/^data:[^,]*,/, ""), "base64");
        } else {
            const devanagariFontPath = path.join(__dirname, "fonts", "NotoSansDevanagari-Regular.ttf");
            const header = (lang === 'mr' && schema.title_mr) ? schema.title_mr : (schema.title_en || schema.title || form_type);

            const doc2 = new PDFDocument({ margin: 50, size: "A4" });
            const writeStream = fs.createWriteStream(pdfPath);
            doc2.pipe(writeStream);

            // Only use the Marathi font if the file really has data (an empty .ttf makes pdfkit throw "Unknown font format")
            const hasDevaFont = fs.existsSync(devanagariFontPath) && fs.statSync(devanagariFontPath).size > 0;
            if (hasDevaFont) doc2.registerFont("NotoDeva", devanagariFontPath);
            const useMr = lang === 'mr' && hasDevaFont;
            const fontBold = useMr ? "NotoDeva" : "Helvetica-Bold";
            const fontNormal = useMr ? "NotoDeva" : "Helvetica";

            const pageW = 595 - 100; // A4 width minus margins
            const col1W = pageW * 0.45;
            const col2W = pageW * 0.55;

            // ── Header ──
            doc2.fontSize(14).font(fontBold).text(header, 50, 50, { align: "center", width: pageW });
            doc2.moveDown(0.3);
            doc2.moveTo(50, doc2.y).lineTo(545, doc2.y).lineWidth(1.5).stroke();
            doc2.moveDown(0.5);

            // ── Table header row ──
            const startY = doc2.y;
            doc2.rect(50, startY, col1W, 20).fill("#d0d8e8");
            doc2.rect(50 + col1W, startY, col2W, 20).fill("#d0d8e8");
            doc2.fillColor("#000").fontSize(10).font(fontBold);
            doc2.text("माहिती (Information)", 54, startY + 5, { width: col1W - 4 });
            doc2.text("तपशील (Details)", 54 + col1W, startY + 5, { width: col2W - 4 });
            let rowY = startY + 20;

            // ── Field rows ──
            doc2.fontSize(9).lineWidth(0.5);
            for (let i = 0; i < schema.fields.length; i++) {
                const fld = schema.fields[i];
                const label = (useMr && fld.label_mr) ? fld.label_mr : (fld.label_en || fld.label || fld.name);
                const valueRaw = form_data[fld.name];
                const value = Array.isArray(valueRaw) ? valueRaw.join(", ") : (valueRaw != null && valueRaw !== "" ? String(valueRaw) : "");

                // Calculate row height
                const labelH = doc2.heightOfString(label, { width: col1W - 8, font: fontBold, fontSize: 9 });
                const valueH = doc2.heightOfString(value || " ", { width: col2W - 8, font: fontNormal, fontSize: 9 });
                const rowH = Math.max(labelH, valueH) + 10;

                // Page break check
                if (rowY + rowH > 780) {
                    doc2.addPage();
                    rowY = 50;
                }

                // Row background (alternating)
                if (i % 2 === 0) doc2.rect(50, rowY, pageW, rowH).fill("#f8f9fb");
                else doc2.rect(50, rowY, pageW, rowH).fill("#ffffff");

                // Borders
                doc2.rect(50, rowY, col1W, rowH).stroke("#aaa");
                doc2.rect(50 + col1W, rowY, col2W, rowH).stroke("#aaa");

                // Label
                doc2.fillColor("#333").font(fontBold).fontSize(9)
                    .text(label, 54, rowY + 5, { width: col1W - 8 });

                // Value
                doc2.fillColor("#000").font(fontNormal).fontSize(9)
                    .text(value || "—", 56 + col1W, rowY + 5, { width: col2W - 10 });

                rowY += rowH;
            }

            // Footer
            doc2.moveDown(1);
            if (rowY + 30 > 780) doc2.addPage();
            doc2.fontSize(8).font("Helvetica").fillColor("#888")
                .text(`Generated: ${new Date().toLocaleString("en-IN")} | ${form_type}`, 50, rowY + 10, { align: "center", width: pageW });

            doc2.end();
            await new Promise((resolve, reject) => {
                writeStream.on("finish", resolve);
                writeStream.on("error", reject);
            });
            pdfBuffer = fs.readFileSync(pdfPath);
        }

        // 2) Upload PDF to Supabase Storage
        const uploadPath = `forms/${fileName}`;
        let pdfUrl = null;

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from("exam_pdfs")
            .upload(uploadPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

        if (uploadError) {
            console.error("Supabase upload error:", uploadError.message);
            // Don't fail — serve PDF as base64 data URL as fallback
            pdfUrl = "data:application/pdf;base64," + pdfBuffer.toString("base64");
        } else {
            // 3) Get public URL
            const { data: publicData } = supabase
                .storage
                .from("exam_pdfs")
                .getPublicUrl(uploadPath);
            pdfUrl = publicData ? publicData.publicUrl : null;
        }

        // cleanup local file
        try { fs.unlinkSync(pdfPath); } catch (e) { /* ignore */ }

        // 4) Insert submission record (table: submissions)
        const submission = {
            user_id: user_id || null,
            form_type,
            form_data,
            pdf_url: typeof pdfUrl === "string" && pdfUrl.startsWith("data:") ? "(base64 - too large for DB)" : pdfUrl
        };
        const { error: insertError } = await supabase
            .from("submissions")
            .insert([submission]);

        if (insertError) {
            // Log but don't fail — DB record is optional, PDF is what matters
            console.warn("DB insert warning (submissions table may not exist):", insertError.message);
        }

        // 5) Email the PDF to admin + CC (failure is logged, never blocks the user's download)
        let email;
        try {
            email = await sendSubmissionEmail({ form_type, form_data, pdfBuffer, pdfUrl, fileName });
        } catch (mailErr) {
            console.error("Admin email error:", mailErr.message);
            email = { sent: false, reason: mailErr.message };
        }

        // Always return pdfUrl — DB insert / email failures are non-fatal
        res.json({ message: "Submitted successfully", pdfUrl, email_sent: email.sent });

    } catch (err) {
        console.error("Server error processing submit:", err);
        res.status(500).json({ message: "Server error", error: String(err) });
    }
});

// ── Admin email ─────────────────────────────────────────────────────────────
// Render's free tier blocks outbound SMTP (ports 25/465/587), so on Render the
// mail goes through Brevo's HTTPS API (BREVO_API_KEY). Gmail SMTP is only used
// as a fallback when no API key is set (e.g. local development).
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const splitEmails = (v) => String(v || "").split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);

async function sendSubmissionEmail({ form_type, form_data, pdfBuffer, pdfUrl, fileName }) {
    const to = splitEmails(process.env.ADMIN_EMAIL || process.env.SMTP_USER);
    const cc = splitEmails(process.env.CC_EMAIL).filter(e => !to.includes(e));
    const sender = process.env.SENDER_EMAIL || process.env.SMTP_USER;
    if (!to.length || !sender) {
        console.warn("Email skipped: set ADMIN_EMAIL and SENDER_EMAIL (or SMTP_USER) in the environment.");
        return { sent: false, reason: "email not configured" };
    }

    const rows = Object.entries(form_data || {})
        .map(([k, v]) => `<tr><td style="padding:4px 10px;border:1px solid #ddd;font-weight:bold">${escapeHtml(k)}</td><td style="padding:4px 10px;border:1px solid #ddd">${escapeHtml(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`)
        .join("");
    const linkHtml = pdfUrl && !pdfUrl.startsWith("data:")
        ? `<p><strong>PDF Download Link:</strong> <a href="${escapeHtml(pdfUrl)}">${escapeHtml(pdfUrl)}</a></p>` : "";
    const subject = `New Form Submission — ${form_type}`;
    const html = `
        <h2 style="color:#0056b3">${escapeHtml(subject)}</h2>
        <p>The filled form PDF is attached.</p>
        ${linkHtml}
        <hr>
        <h3>Submitted Fields</h3>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>
        <br>
        <p style="color:#888;font-size:12px">This is an automated notification from MyExam Forms.</p>
    `;

    if (process.env.BREVO_API_KEY) {
        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                sender: { name: "MyExam Forms", email: sender },
                to: to.map(email => ({ email })),
                ...(cc.length ? { cc: cc.map(email => ({ email })) } : {}),
                subject,
                htmlContent: html,
                attachment: [{ name: fileName, content: pdfBuffer.toString("base64") }],
            }),
        });
        if (!resp.ok) throw new Error(`Brevo ${resp.status}: ${await resp.text()}`);
    } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s/g, "") },
            connectionTimeout: 15000,
        });
        await transporter.sendMail({
            from: `"MyExam Forms" <${sender}>`,
            to: to.join(", "),
            cc: cc.join(", ") || undefined,
            subject,
            html,
            attachments: [{ filename: fileName, content: pdfBuffer, contentType: "application/pdf" }],
        });
    } else {
        console.warn("Email skipped: set BREVO_API_KEY (or SMTP_USER/SMTP_PASS for local use).");
        return { sent: false, reason: "no email provider configured" };
    }

    console.log(`Email sent for ${form_type} → to: ${to.join(", ")}${cc.length ? ` | cc: ${cc.join(", ")}` : ""}`);
    return { sent: true };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
