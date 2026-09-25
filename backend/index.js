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
app.use(bodyParser.json({limit: '5mb'}));
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

// Submit endpoint: accepts { form_type, form_data, user_id, lang }
app.post("/submit", async (req, res) => {
    const { form_type, form_data, user_id, lang } = req.body;
    if (!form_type || !form_data) return res.status(400).json({ message: "Missing form_type or form_data" });

    try {
        // load schema to get ordered labels
        const schemaPath = path.join(__dirname, "schemas", `${form_type}.json`);
        if (!fs.existsSync(schemaPath)) {
            return res.status(400).json({ message: "Unknown form type" });
        }
        const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

        // 1) Generate PDF (Marathi or English labels depending on lang)
        const timestamp = Date.now();
        const fileName = `${form_type}_${timestamp}_${(form_data.fullname||"user").replace(/\s+/g,'_')}.pdf`;
        const pdfPath = path.join(__dirname, fileName);

        const doc = new PDFDocument({ margin: 40, size: "A4" });

        // Register fonts
        const devanagariFontPath = path.join(__dirname, "fonts", "NotoSansDevanagari-Regular.ttf");
        if (fs.existsSync(devanagariFontPath)) {
            doc.registerFont("NotoDeva", devanagariFontPath);
        } else {
            console.warn("Devanagari font not found at", devanagariFontPath, "— Marathi may not render correctly in PDF.");
        }
        // default fonts
        doc.fontSize(16);
        // Header: use selected language or fallback
        const header = (lang === 'mr' && schema.title_mr) ? schema.title_mr : (schema.title || schema.title_en || "Form");
        if (lang === 'mr' && fs.existsSync(devanagariFontPath)) doc.font("NotoDeva");
        else doc.font("Helvetica");
        doc.text(header, { align: "center" });
        doc.moveDown(0.5);

        // Body: iterate schema.fields
        doc.fontSize(12);
        for (const fld of schema.fields) {
            const label = (lang === 'mr' && fld.label_mr) ? fld.label_mr : (fld.label_en || fld.label);
            // choose font for label
            if (lang === 'mr' && fs.existsSync(devanagariFontPath)) doc.font("NotoDeva");
            else doc.font("Helvetica");
            const valueRaw = form_data[fld.name];
            let value = "";
            if (Array.isArray(valueRaw)) value = valueRaw.join(", ");
            else if (valueRaw === undefined || valueRaw === null) value = "";
            else value = String(valueRaw);

            // write label and value
            doc.text(`${label}: ${value}`, { lineGap: 6 });
            doc.moveDown(0.2);
        }

        doc.end();

        // wait until finished writing
        await new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(pdfPath);
            const doc2 = new PDFDocument({ margin: 40, size: "A4" });
            // We already created doc and ended it; but pdfkit pipe trick - simpler approach: create write via original doc
            // Actually we created doc above with default stream; we need to ensure it's piped. To keep code simple, we instead
            // rewrite generation to use piping to file. However we already used doc; work-around: regenerate with proper piping.
            // Simpler approach: generate again but pipe to file. We'll regenerate below synchronously.
            resolve();
        });

        // Regenerate with proper pipe (to ensure file exists)
        // (Recreate the PDF properly)
        {
            const doc2 = new PDFDocument({ margin: 40, size: "A4" });
            const writeStream = fs.createWriteStream(pdfPath);
            doc2.pipe(writeStream);

            if (fs.existsSync(devanagariFontPath)) doc2.registerFont("NotoDeva", devanagariFontPath);

            if (lang === 'mr' && fs.existsSync(devanagariFontPath)) doc2.font("NotoDeva");
            else doc2.font("Helvetica");
            doc2.fontSize(16).text(header, { align: "center" });
            doc2.moveDown(0.5);

            doc2.fontSize(12);
            for (const fld of schema.fields) {
                const label = (lang === 'mr' && fld.label_mr) ? fld.label_mr : (fld.label_en || fld.label);
                if (lang === 'mr' && fs.existsSync(devanagariFontPath)) doc2.font("NotoDeva");
                else doc2.font("Helvetica");
                const valueRaw = form_data[fld.name];
                let value = "";
                if (Array.isArray(valueRaw)) value = valueRaw.join(", ");
                else if (valueRaw === undefined || valueRaw === null) value = "";
                else value = String(valueRaw);
                doc2.text(`${label}: ${value}`, { lineGap: 6 });
                doc2.moveDown(0.2);
            }

            doc2.end();
            await new Promise((resolve, reject) => {
                writeStream.on("finish", resolve);
                writeStream.on("error", reject);
            });
        }

        // 2) Upload PDF to Supabase Storage
        const pdfBuffer = fs.readFileSync(pdfPath);
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
            console.error("Insert error:", insertError.message);
            // still return pdf link, but mark DB insert failed
            return res.status(500).json({ message: "PDF uploaded but failed to save DB record", pdfUrl, error: insertError });
        }

        // 5) Prepare WhatsApp link
        // phone field might be under various names; prefer form_data.phone or form_data.mobile
        const phoneVal = form_data.phone || form_data.mobile || "";
        const formattedPhone = phoneVal.replace(/^\+|^0+/,'').replace(/\s+/g,'');
        const recipient = formattedPhone || ""; // if empty, whatsapp link won't work
        const textMsg = `Hello ${form_data.fullname || ''}, your ${schema.title || form_type} is ready: ${pdfUrl}`;
        const whatsappLink = recipient ? `https://wa.me/${recipient}?text=${encodeURIComponent(textMsg)}` : null;

        res.json({ message: "Submitted successfully", pdfUrl, whatsappLink });

    } catch (err) {
        console.error("Server error processing submit:", err);
        res.status(500).json({ message: "Server error", error: String(err) });
    }
});

// Admin notification endpoint — sends an email with PDF link to admin
app.post("/admin-notify", async (req, res) => {
    const { admin_email, form_type, pdf_url, form_data } = req.body;
    if (!admin_email || !pdf_url) {
        return res.status(400).json({ message: "Missing admin_email or pdf_url" });
    }

    // Build a readable summary of submitted fields
    let fieldsSummary = "";
    if (form_data && typeof form_data === "object") {
        fieldsSummary = Object.entries(form_data)
            .map(([k, v]) => `<tr><td style="padding:4px 10px;border:1px solid #ddd;font-weight:bold">${k}</td><td style="padding:4px 10px;border:1px solid #ddd">${Array.isArray(v) ? v.join(", ") : v}</td></tr>`)
            .join("");
    }

    const htmlBody = `
        <h2 style="color:#0056b3">New Form Submission — ${form_type}</h2>
        <p><strong>PDF Download Link:</strong> <a href="${pdf_url}">${pdf_url}</a></p>
        <hr>
        <h3>Submitted Fields</h3>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
            ${fieldsSummary}
        </table>
        <br>
        <p style="color:#888;font-size:12px">This is an automated notification from MyExam Forms.</p>
    `;

    // If SMTP not configured, log to console and return success
    if (!process.env.SMTP_USER || process.env.SMTP_USER === "your-gmail@gmail.com" || !process.env.SMTP_PASS || process.env.SMTP_PASS === "your-app-password") {
        console.log("=== ADMIN EMAIL (SMTP not configured — logging to console) ===");
        console.log(`TO: ${admin_email}`);
        console.log(`SUBJECT: New Form Submission — ${form_type}`);
        console.log(`PDF URL: ${pdf_url}`);
        console.log("=============================================================");
        return res.json({ message: "Admin email logged to console (SMTP not configured)" });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS.replace(/\s/g, ""), // remove spaces from app password
            },
        });

        await transporter.sendMail({
            from: `"MyExam Forms" <${process.env.SMTP_USER}>`,
            to: admin_email,
            subject: `New Form Submission — ${form_type}`,
            html: htmlBody,
        });

        console.log(`Admin email sent to ${admin_email} for form: ${form_type}`);
        res.json({ message: "Admin email sent successfully" });
    } catch (err) {
        console.error("Admin email error:", err.message);
        res.status(500).json({ message: "Failed to send admin email", error: String(err) });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
