import Busboy from "busboy";
import pdf from "pdf-parse";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const chunks = [];

    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;

    const filePromise = new Promise((resolve, reject) => {
      busboy.on("file", (name, file, info) => {
        const { filename, mimeType } = info;
        if (!mimeType.includes("pdf")) {
          reject(new Error("Only PDF files are allowed"));
        }

        file.on("data", (data) => {
          chunks.push(data);
        });

        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on("finish", () => resolve());
      busboy.on("error", (err) => reject(err));

      req.pipe(busboy);
    });

    await filePromise;

    // Validate size
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large (max 5MB)" });
    }

    // Extract PDF text
    const data = await pdf(fileBuffer);

    if (!data.text || data.text.trim().length === 0) {
      return res.status(400).json({ error: "No text extracted from PDF" });
    }

    // Trim to 10k chars
    let text = data.text.trim();
    if (text.length > 10000) text = text.slice(0, 10000);

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
