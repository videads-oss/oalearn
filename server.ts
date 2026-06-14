import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Safe Firebase Initialization
  let db: any = null;
  let firebaseActive = false;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const appFirebase = initializeApp(firebaseConfig);
      db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
      firebaseActive = true;
      console.log("Firebase initialized successfully on server-side!");
    } else {
      console.warn("firebase-applet-config.json not found. Serving with SEO fallbacks.");
    }
  } catch (error) {
    console.error("Firebase server-side initialization failed:", error);
  }

  // Helper to fetch metadata from Firestore
  async function getPdfMetadata(pdfId: string) {
    if (!firebaseActive || !db) return null;
    try {
      const pdfSnap = await getDoc(doc(db, 'pdfs', pdfId));
      if (pdfSnap.exists()) {
        return pdfSnap.data();
      }
    } catch (error) {
      console.error('Error fetching PDF metadata from Firestore:', error);
    }
    return null;
  }

  // Helper to inject SEO tags dynamically into the HTML shell
  function injectSeoMetadata(html: string, pdfData: any, pdfId: string): string {
    if (!pdfData) {
      return html.replace(
        /<title>.*?<\/title>/gi,
        '<title>Study Material | Officers Academy</title>'
      );
    }

    const title = `${pdfData.title} | Officers Academy Study Material`;
    const cleanDesc = (pdfData.description || 'Verified Study Material & PDF Portal for competitive exams.')
      .replace(/[#*`_]/g, '')
      .substring(0, 160)
      .trim();

    const imageUrl = pdfData.coverUrl || 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=800';
    const pageUrl = `https://msarkari-com-118626.web.app/pdf/${pdfId}`;

    const seoTags = `
  <title>${title}</title>
  <meta name="description" content="${cleanDesc}" />
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${pdfData.title} - PDF Download" />
  <meta property="og:description" content="${cleanDesc}" />
  <meta property="og:image" content="${imageUrl}" />
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="${pageUrl}" />
  <meta property="twitter:title" content="${pdfData.title} - PDF Download" />
  <meta property="twitter:description" content="${cleanDesc}" />
  <meta property="twitter:image" content="${imageUrl}" />
    `;

    let result = html;
    // Remove original title tags
    result = result.replace(/<title>.*?<\/title>/gi, '');
    // Inject the new tags into <head>
    result = result.replace('<head>', `<head>\n  ${seoTags}`);
    return result;
  }

  // API Routes / Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Intercept PDF page requests for dynamic server-side SEO metadata injection
  app.get(["/pdf/:id", "/pdf/:id/"], async (req, res, next) => {
    let pdfId = req.params.id;

    // Skip assets or static files that might match this route
    if (!pdfId || pdfId.includes('.')) {
      return next();
    }

    // Clean trailing slash if present
    if (pdfId.endsWith('/')) {
      pdfId = pdfId.slice(0, -1);
    }

    try {
      const pdfData = await getPdfMetadata(pdfId);
      
      let htmlFileContent = '';
      if (process.env.NODE_ENV !== "production") {
        htmlFileContent = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const vite = await getViteInstance();
        // Transform index.html with Vite's injection helper in dev mode
        htmlFileContent = await vite.transformIndexHtml(req.originalUrl, htmlFileContent);
      } else {
        htmlFileContent = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
      }

      const finalizedHtml = injectSeoMetadata(htmlFileContent, pdfData, pdfId);
      res.status(200).set({ "Content-Type": "text/html" }).send(finalizedHtml);
    } catch (err) {
      console.error("Express routing error during PDF page request - falling back to normal SPA index.html:", err);
      // Fail-safe: load plain index.html layout so the frontend React SPA can boot up and render without crashing
      try {
        let htmlFileContent = '';
        if (process.env.NODE_ENV !== "production") {
          htmlFileContent = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
          const vite = await getViteInstance();
          htmlFileContent = await vite.transformIndexHtml(req.originalUrl, htmlFileContent);
        } else {
          htmlFileContent = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
        }
        res.status(200).set({ "Content-Type": "text/html" }).send(htmlFileContent);
      } catch (innerErr) {
        // Ultimate backup response
        res.status(500).send("Internal Server Error");
      }
    }
  });

  // Lazy cache Vite instance to ensure correct dev server loading
  let viteInstance: any = null;
  async function getViteInstance() {
    if (!viteInstance) {
      viteInstance = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
    }
    return viteInstance;
  }

  // Vite middlewares/SPA static routing setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await getViteInstance();
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve static frontend files
    app.use(express.static(distPath, { index: false }));
    
    // SPA catch-all for any other pathways
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
