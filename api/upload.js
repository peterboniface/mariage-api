import { google } from "googleapis";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Convertit un Buffer en ReadableStream (Google Drive l'exige)
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-upload-secret, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // ------------

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  if (req.headers["x-upload-secret"] !== process.env.UPLOAD_SECRET) {
    return res.status(401).json({ error: "Clé secrète invalide" });
  }

  console.log("Requête reçue !");

  const busboy = await import("busboy").then(m => m.default);
  const bb = busboy({ headers: req.headers });

  const files = [];

  bb.on("file", (name, file, info) => {
    const { filename, mimeType } = info;

    const bufferChunks = [];
    file.on("data", (data) => bufferChunks.push(data));
    file.on("end", () => {
      files.push({
        filename,
        mimeType,
        buffer: Buffer.concat(bufferChunks),
      });
    });
  });

  bb.on("finish", async () => {
    try {
      if (files.length === 0) {
        return res.status(400).json({ error: "Aucun fichier reçu" });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      const drive = google.drive({ version: "v3", auth });

      const file = files[0];

      const uploaded = await drive.files.create({
        requestBody: {
          name: file.filename,
          parents: [process.env.GOOGLE_FOLDER_ID],
        },
        media: {
          mimeType: file.mimeType,
          body: bufferToStream(file.buffer), // <-- FIX ICI
        },
      });

      console.log("Upload OK :", uploaded.data.id);

      return res.status(200).json({
        success: true,
        fileId: uploaded.data.id
      });

    } catch (err) {
      console.error("Erreur upload :", err.message, err.stack);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  req.pipe(bb);
}
