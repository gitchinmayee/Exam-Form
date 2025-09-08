const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const PDFDocument = require("pdfkit");
const fs = require("fs");
require("dotenv").config({ path: __dirname + "/.env" });

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize Supabase Client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("Supabase environment variables missing!");
    process.exit(1);
}
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

app.post("/submit", async (req, res) => {
    const data = req.body;

    try {
        // 1. Generate PDF
        const fileName = `exam_form_${Date.now()}_${data.fullname}.pdf`;
        const pdfPath = `./${fileName}`;
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        doc.fontSize(20).text("Exam Registration Form", { align: "center" });
        doc.moveDown();
        doc.fontSize(14).text(`Full Name: ${data.fullname}`);
        doc.text(`Email: ${data.email}`);
        doc.text(`Phone: ${data.phone}`);
        doc.text(`DOB: ${data.dob}`);
        doc.text(`Course: ${data.course}`);
        doc.text(`Semester: ${data.semester}`);
        doc.text(`Exam Mode: ${data.exam_mode}`);
        doc.text(`Subjects: ${data.subjects.join(", ")}`);
        doc.end();

        writeStream.on("finish", async () => {
            try {
                // 2. Upload PDF to Supabase Storage
                const pdfBuffer = fs.readFileSync(pdfPath);
                const { error: uploadError } = await supabase
                    .storage
                    .from("exam_pdfs")
                    .upload(`forms/${fileName}`, pdfBuffer, {
                        contentType: "application/pdf",
                        upsert: true
                    });

                fs.unlinkSync(pdfPath); // Delete temp file

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    return res.status(500).json({ message: "Failed to upload PDF" });
                }

                // 3. Get public URL for uploaded PDF
                const { data: publicUrlData } = supabase
                    .storage
                    .from("exam_pdfs")
                    .getPublicUrl(`forms/${fileName}`);
                const pdfUrl = publicUrlData.publicUrl;

                // 4. Insert form details into Supabase Database
                const { error: insertError } = await supabase
                    .from("exam_forms")
                    .insert([{
                        fullname: data.fullname,
                        email: data.email,
                        phone: data.phone,
                        dob: data.dob,
                        course: data.course,
                        semester: data.semester,
                        exam_mode: data.exam_mode,
                        subjects: data.subjects,
                        pdf_url: pdfUrl
                    }]);

                if (insertError) {
                    console.error("Insert error:", insertError);
                    return res.status(500).json({ message: "Failed to save form in database" });
                }

                // 5. Generate WhatsApp Link
                const formattedPhone = data.phone.replace(/^0+|\+/g, ''); // remove + or leading 0s
                const whatsappLink = `https://wa.me/${formattedPhone}?text=Hello%20${encodeURIComponent(data.fullname)},%20your%20exam%20form%20is%20ready:%20${encodeURIComponent(pdfUrl)}`;

                // Final response with WhatsApp sharing
                res.json({
                    message: "Form submitted successfully!",
                    pdfUrl,
                    whatsappLink
                });

            } catch (err) {
                console.error("Processing error:", err);
                res.status(500).json({ message: "Error processing form" });
            }
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
