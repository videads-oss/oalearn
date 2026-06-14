import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Define ESM-compatible __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Determine robustly if we are running in a compiled production container state
  const isProduction = process.env.NODE_ENV === "production" || __filename.includes('dist');
  console.log(`[SEO Engine] Detected Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

  // Helper to dynamically resolve index.html location depending on the runtime context
  function getHtmlFilePath(): string {
    const possiblePaths = isProduction 
      ? [
          path.join(__dirname, 'index.html'), // Proximity-first inside dist/ folder
          path.join(process.cwd(), 'dist', 'index.html'), // Absolute working directory path
        ]
      : [
          path.join(process.cwd(), 'index.html'), // Dev environment root-level
          path.join(__dirname, 'index.html'),
          path.join(__dirname, '..', 'index.html'),
        ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    // Safe ultimate fallback paths
    return isProduction ? path.join(process.cwd(), 'dist', 'index.html') : path.join(process.cwd(), 'index.html');
  }

  // Rewrite/Redirect relative asset requests made from subpages like /pdf/:id
  app.use((req, res, next) => {
    // If the browser requests a static file under /pdf/ (e.g., /pdf/assets/logo.png or /pdf/favicon.ico)
    if (req.path.startsWith('/pdf/') && (req.path.includes('/assets/') || req.path.includes('/src/') || req.path.match(/\.[a-zA-Z0-9]+$/))) {
      const cleanPath = req.url.replace(/^\/pdf/, '');
      console.log(`[Asset Rewriter] Transforming subpage layout asset request: ${req.url} -> ${cleanPath}`);
      req.url = cleanPath; // Perform the internal express rewrite seamlessly
    }
    next();
  });

  // API Routes / Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Intercept PDF page requests for dynamic server-side SEO metadata injection
  // Supporting optional trailing slashes at the Express router match level
  app.get(["/pdf/:id", "/pdf/:id/"], async (req, res, next) => {
    let pdfId = req.params.id;

    console.log(`[SEO Engine] Intercepted PDF subpage request: ${req.originalUrl}, PDF ID parsed: ${pdfId}`);

    // Skip assets or static files that might match this route
    if (!pdfId || pdfId.includes('.') || pdfId === 'assets' || pdfId === 'src') {
      return next();
    }

    // Clean trailing slash if present
    if (pdfId.endsWith('/')) {
      pdfId = pdfId.slice(0, -1);
    }

    try {
      const pdfData = await getPdfMetadata(pdfId);
      const htmlPath = getHtmlFilePath();
      let htmlFileContent = fs.readFileSync(htmlPath, 'utf-8');

      if (!isProduction) {
        const vite = await getViteInstance();
        // Transform index.html with Vite's injection helper in dev mode
        htmlFileContent = await vite.transformIndexHtml(req.originalUrl, htmlFileContent);
      }

      const finalizedHtml = injectSeoMetadata(htmlFileContent, pdfData, pdfId);
      res.status(200).set({ "Content-Type": "text/html" }).send(finalizedHtml);
    } catch (err) {
      console.error("[SEO Engine] Error during PDF page request - falling back to raw SPA index.html:", err);
      // Fail-safe: load plain index.html layout so the frontend React SPA can boot up and render without crashing
      try {
        const htmlPath = getHtmlFilePath();
        let htmlFileContent = fs.readFileSync(htmlPath, 'utf-8');
        
        if (!isProduction) {
          const vite = await getViteInstance();
          htmlFileContent = await vite.transformIndexHtml(req.originalUrl, htmlFileContent);
        }
        res.status(200).set({ "Content-Type": "text/html" }).send(htmlFileContent);
      } catch (innerErr) {
        console.error("[SEO Engine] Severe fallback error, sending default shell:", innerErr);
        // Absolute fallback response
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
  if (!isProduction) {
    const vite = await getViteInstance();
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve static frontend files
    app.use(express.static(distPath, { index: false }));
    
    // SPA catch-all for any other pathways
    app.get('*', (req, res) => {
      const htmlPath = getHtmlFilePath();
      res.sendFile(htmlPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
