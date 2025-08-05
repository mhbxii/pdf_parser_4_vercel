import Busboy from "busboy";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const chunks = [];
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;

    const filePromise = new Promise((resolve, reject) => {
      busboy.on("file", (fieldname, file, info) => {
        const { mimeType } = info;
        if (mimeType !== "application/pdf") {
          reject(new Error("Only PDF files allowed"));
        }
        file.on("data", (data) => chunks.push(data));
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });
      busboy.on("finish", () => resolve());
      busboy.on("error", (err) => reject(err));
      req.pipe(busboy);
    });

    await filePromise;

    if (!fileBuffer) throw new Error("No file uploaded");
    if (fileBuffer.length > 5 * 1024 * 1024)
      return res.status(400).json({ error: "File too large (max 5MB)" });

    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdfDoc = await loadingTask.promise;

    if (pdfDoc.numPages > 5)
      return res.status(400).json({ error: "PDF exceeds 5 pages max" });

    let text = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => item.str);
      text += strings.join(" ") + "\n\n";
    }

    text = text.trim();
    if (text.length === 0)
      return res.status(400).json({ error: "No text extracted from PDF" });

    if (text.length > 10000) text = text.slice(0, 10000);

    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
