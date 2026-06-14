import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { ZipArchive } from "archiver";

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
  const isProduction = process.env.NODE_ENV === "production" || 
    (process.argv[1] && (process.argv[1].includes('dist/server') || process.argv[1].includes('dist\\server') || process.argv[1].endsWith('server.cjs')));
  console.log(`[SEO Engine] Detected Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

  // Helper to dynamically resolve index.html location depending on the runtime context
  function getHtmlFilePath(): string {
    const possiblePaths = isProduction 
      ? [
          path.join(process.cwd(), 'dist', 'index.html'), // Absolute working directory path in production
        ]
      : [
          path.join(process.cwd(), 'index.html'), // Dev environment root-level
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

  // Dynamic WordPress Theme Packaging & Zipped Downstream Delivery Endpoint
  app.get("/api/download-wp-theme", async (req, res) => {
    console.log("[WP Exporter] Received WordPress Theme packaging request...");
    const themeDir = path.join(process.cwd(), "officers-academy-theme");
    const assetsSource = path.join(process.cwd(), "dist", "assets");
    const themeAssetsDir = path.join(themeDir, "assets");

    try {
      // 1. Create Directories if not exist
      if (!fs.existsSync(themeDir)) {
        fs.mkdirSync(themeDir, { recursive: true });
      }
      if (!fs.existsSync(themeAssetsDir)) {
        fs.mkdirSync(themeAssetsDir, { recursive: true });
      }

      // 2. Write/Sync WordPress Theme Files (style.css, index.php, functions.php)
      const styleCssContent = `/*
Theme Name: Officers Academy
Theme URI: https://ai.studio/build
Author: Officers Academy Team
Description: Fully responsive React-based fast PDF portal and study material share network with advanced search, live indexing, and statistics.
Version: 1.0.0
License: GNU General Public License v2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Text Domain: officers-academy
Tags: responsive-layout, custom-background, featured-images, translation-ready, dark-scheme
*/`;

      const indexPhpContent = `<?php
/**
 * The main template file
 *
 * @package Officers_Academy
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php wp_head(); ?>
</head>
<body <?php body_class('bg-[#FDFBF2] text-black selection:bg-yellow-400 select-none'); ?>>
    <?php wp_body_open(); ?>
    
    <div id="root"></div>

    <?php wp_footer(); ?>
</body>
</html>`;

      const functionsPhpContent = `<?php
/**
 * Officers Academy Theme Functions
 */

// Register PDF Custom Post Type
function officers_academy_register_types() {
    register_post_type('pdf', array(
        'labels' => array(
            'name' => 'PDF Study Guides',
            'singular_name' => 'PDF Guide',
            'add_new_item' => 'Add New PDF Guide',
            'edit_item' => 'Edit PDF Guide',
            'new_item' => 'New PDF Guide',
            'view_item' => 'View PDF Guide',
            'all_items' => 'All PDF Study Guides',
        ),
        'public' => true,
        'has_archive' => false,
        'supports' => array('title', 'editor', 'thumbnail'),
        'show_in_rest' => true,
        'menu_icon' => 'dashicons-pdf-alt',
        'taxonomies' => array('pdf_cat'),
    ));
    
    register_taxonomy('pdf_cat', 'pdf', array(
        'labels' => array(
            'name' => 'Study Categories',
            'singular_name' => 'Study Category',
            'add_new' => 'Add New Category',
            'all_items' => 'All Categories'
        ),
        'hierarchical' => true,
        'show_in_rest' => true,
    ));
}
add_action('init', 'officers_academy_register_types');

// Enqueue React built-compilations dynamically
function officers_academy_enqueue_assets() {
    $theme_dir = get_template_directory();
    $assets_dir = $theme_dir . '/assets';
    
    $js_file = '';
    $css_file = '';
    
    if (is_dir($assets_dir)) {
        $files = scandir($assets_dir);
        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'js') {
                $js_file = 'assets/' . $file;
            } elseif (pathinfo($file, PATHINFO_EXTENSION) === 'css') {
                $css_file = 'assets/' . $file;
            }
        }
    }
    
    if (!empty($js_file)) {
        wp_enqueue_script(
            'officers-academy-react-js',
            get_template_directory_uri() . '/' . $js_file,
            array(),
            '1.0.0',
            true
        );
    }
    
    if (!empty($css_file)) {
        wp_enqueue_style(
            'officers-academy-react-css',
            get_template_directory_uri() . '/' . $css_file,
            array(),
            '1.0.0'
        );
    }
    
    // Inject localization data of theme contexts to support React SPA routing dynamically!
    wp_localize_script('officers-academy-react-js', 'wpData', array(
        'rootUrl'     => get_home_url(),
        'restBaseUrl' => get_rest_url(null, 'officers-academy/v1'),
        'apiNonce'    => wp_create_nonce('wp_rest'),
        'currentThemeUrl' => get_template_directory_uri(),
        'siteName'    => get_bloginfo('name'),
        'siteSub'     => get_bloginfo('description')
    ));
}
add_action('wp_enqueue_scripts', 'officers_academy_enqueue_assets');

// Custom Meta Box for PDF attributes editing
function officers_academy_add_fields_box() {
    add_meta_box('oa_fields', 'PDF Study Guide Parameters', 'officers_academy_render_fields_box', 'pdf', 'normal', 'high');
}
add_action('add_meta_boxes', 'officers_academy_add_fields_box');

function officers_academy_render_fields_box($post) {
    $file_size = get_post_meta($post->ID, 'pdf_file_size', true);
    $page_count = get_post_meta($post->ID, 'pdf_page_count', true);
    $view_url = get_post_meta($post->ID, 'pdf_third_party_view_url', true);
    $download_url = get_post_meta($post->ID, 'pdf_third_party_download_url', true);
    $cover_url = get_post_meta($post->ID, 'pdf_cover_url', true);
    $members_only = get_post_meta($post->ID, 'pdf_members_only', true);
    $views = get_post_meta($post->ID, 'pdf_click_count', true) ?: 0;
    $downloads = get_post_meta($post->ID, 'pdf_download_count', true) ?: 0;
    
    wp_nonce_field('oa_fields_nonce_action', 'oa_fields_nonce');
    ?>
    <div style="padding:10px 0;">
        <p><strong>File Size (e.g. 1.5 MB):</strong><br/>
        <input type="text" name="pdf_file_size" value="<?php echo esc_attr($file_size); ?>" style="width:100%; max-width:400px;" placeholder="1.5 MB"></p>
        
        <p><strong>Page Count:</strong><br/>
        <input type="number" name="pdf_page_count" value="<?php echo esc_attr($page_count); ?>" style="width:150px;"></p>
        
        <p><strong>Third Party Viewer Link (optional):</strong><br/>
        <input type="text" name="pdf_third_party_view_url" value="<?php echo esc_url($view_url); ?>" style="width:100%;"></p>
        
        <p><strong>Third Party SECURE Direct Download Link:</strong><br/>
        <input type="text" name="pdf_third_party_download_url" value="<?php echo esc_url($download_url); ?>" style="width:100%;" required></p>
        
        <p><strong>Custom Cover Image URL (optional, defaults to standard WP Featured Image):</strong><br/>
        <input type="text" name="pdf_cover_url" value="<?php echo esc_url($cover_url); ?>" style="width:100%;" placeholder="https://..."></p>
        
        <p><label><input type="checkbox" name="pdf_members_only" value="yes" <?php checked($members_only, 'yes'); ?>> Only show to signed-in/member emails.</label></p>
        
        <p style="background:#eff5f5; padding:8px; border-left:4px solid #00b4d8; display:inline-block;">
            📊 Views: <strong><?php echo esc_html($views); ?></strong> | 📥 Downloads: <strong><?php echo esc_html($downloads); ?></strong>
        </p>
    </div>
    <?php
}

function officers_academy_save_fields($post_id) {
    if (!isset($_POST['oa_fields_nonce']) || !wp_verify_nonce($_POST['oa_fields_nonce'], 'oa_fields_nonce_action')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    
    $fields = array('pdf_file_size', 'pdf_page_count', 'pdf_third_party_view_url', 'pdf_third_party_download_url', 'pdf_cover_url');
    foreach ($fields as $field) {
        if (isset($_POST[$field])) {
            update_post_meta($post_id, $field, sanitize_text_field($_POST[$field]));
        }
    }
    $members = isset($_POST['pdf_members_only']) && $_POST['pdf_members_only'] === 'yes' ? 'yes' : 'no';
    update_post_meta($post_id, 'pdf_members_only', $members);
}
add_action('save_post', 'officers_academy_save_fields');

// Register REST Endpoints for frontend retrieval
function officers_academy_add_routes() {
    register_rest_route('officers-academy/v1', '/pdfs', array(
        'methods' => 'GET',
        'callback' => 'oa_get_pdfs',
        'permission_callback' => '__return_true'
    ));
    register_rest_route('officers-academy/v1', '/categories', array(
        'methods' => 'GET',
        'callback' => 'oa_get_categories',
        'permission_callback' => '__return_true'
    ));
    register_rest_route('officers-academy/v1', '/pdf/(?P<id>\\d+)/view', array(
        'methods' => 'POST',
        'callback' => 'oa_inc_view',
        'permission_callback' => '__return_true'
    ));
    register_rest_route('officers-academy/v1', '/pdf/(?P<id>\\d+)/download', array(
        'methods' => 'POST',
        'callback' => 'oa_inc_download',
        'permission_callback' => '__return_true'
    ));
}
add_action('rest_api_init', 'officers_academy_add_routes');

function oa_get_pdfs() {
    $query = new WP_Query(array('post_type' => 'pdf', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $pdfs = array();
    
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $id = get_the_ID();
            
            $terms = get_the_terms($id, 'pdf_cat');
            $category = 'Study Notes';
            if ($terms && !is_wp_error($terms)) {
                $category = $terms[0]->name;
            }
            
            $cover = get_post_meta($id, 'pdf_cover_url', true);
            if (empty($cover)) {
                $img_id = get_post_thumbnail_id($id);
                if ($img_id) $cover = wp_get_attachment_image_url($img_id, 'large');
            }
            
            $pdfs[] = array(
                'id' => (string)$id,
                'title' => get_the_title(),
                'description' => get_the_content(),
                'fileSize' => get_post_meta($id, 'pdf_file_size', true) ?: '1.5 MB',
                'pageCount' => intval(get_post_meta($id, 'pdf_page_count', true)) ?: 1,
                'category' => $category,
                'tags' => array(),
                'thirdPartyViewUrl' => get_post_meta($id, 'pdf_third_party_view_url', true) ?: '',
                'thirdPartyDownloadUrl' => get_post_meta($id, 'pdf_third_party_download_url', true) ?: '',
                'coverUrl' => $cover,
                'clickCount' => intval(get_post_meta($id, 'pdf_click_count', true)) ?: 0,
                'downloadCount' => intval(get_post_meta($id, 'pdf_download_count', true)) ?: 0,
                'createdAt' => get_the_date('c'),
                'membersOnly' => get_post_meta($id, 'pdf_members_only', true) === 'yes'
            );
        }
        wp_reset_postdata();
    }
    return new WP_REST_Response($pdfs, 200);
}

function oa_get_categories() {
    $terms = get_terms(array('taxonomy' => 'pdf_cat', 'hide_empty' => false));
    $cats = array();
    if ($terms && !is_wp_error($terms)) {
        foreach ($terms as $t) {
            $cats[] = $t->name;
        }
    }
    if (empty($cats)) {
        $cats = array('Study Notes', 'Previous Year Papers', 'Syllabus & Curriculum', 'Exam Series', 'E-Books & Competitions', 'General Information');
    }
    return new WP_REST_Response($cats, 200);
}

function oa_inc_view($data) {
    $pid = intval($data['id']);
    $views = intval(get_post_meta($pid, 'pdf_click_count', true)) ?: 0;
    $views++;
    update_post_meta($pid, 'pdf_click_count', $views);
    return new WP_REST_Response(array('success' => true, 'clickCount' => $views), 200);
}

function oa_inc_download($data) {
    $pid = intval($data['id']);
    $downloads = intval(get_post_meta($pid, 'pdf_download_count', true)) ?: 0;
    $downloads++;
    update_post_meta($pid, 'pdf_download_count', $downloads);
    return new WP_REST_Response(array('success' => true, 'downloadCount' => $downloads), 200);
}

// Intercept routing so deep reloading works beautifully in SPA
function officers_academy_spa_routing() {
    $uri = $_SERVER['REQUEST_URI'];
    if (!is_admin() && !str_contains($uri, 'wp-json') && !str_contains($uri, 'wp-login') && 
        (str_contains($uri, '/pdf/') || str_contains($uri, '/disclaimer') || str_contains($uri, '/admin'))) {
        
        global $wp_query;
        $wp_query->is_404 = false;
        status_header(200);
        include get_template_directory() . '/index.php';
        exit;
    }
}
add_action('template_redirect', 'officers_academy_spa_routing');
`;

      fs.writeFileSync(path.join(themeDir, "style.css"), styleCssContent);
      fs.writeFileSync(path.join(themeDir, "index.php"), indexPhpContent);
      fs.writeFileSync(path.join(themeDir, "functions.php"), functionsPhpContent);

      // 3. Clear and copy fresh assets from dist/assets/ to themeDir/assets/
      if (fs.existsSync(assetsSource)) {
        if (fs.existsSync(themeAssetsDir)) {
          fs.rmSync(themeAssetsDir, { recursive: true, force: true });
        }
        fs.mkdirSync(themeAssetsDir, { recursive: true });

        const buildFiles = fs.readdirSync(assetsSource);
        for (const file of buildFiles) {
          fs.copyFileSync(path.join(assetsSource, file), path.join(themeAssetsDir, file));
        }
        console.log(`[WP Exporter] Copied ${buildFiles.length} client asset elements to theme folder.`);
      } else {
        console.warn("[WP Exporter] Warning: No compiled client assets found under dist/assets. Build the app first.");
      }

      // 4. Archive theme folder and write to a local ZIP file first
      const zipDestPath = path.join(process.cwd(), "officers-academy-theme.zip");
      const destStream = fs.createWriteStream(zipDestPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      await new Promise<void>((resolve, reject) => {
        destStream.on("close", () => {
          resolve();
        });

        archive.on("error", (archiveErr) => {
          console.error("[WP Exporter] Archive failed:", archiveErr);
          reject(archiveErr);
        });

        archive.pipe(destStream);
        archive.directory(themeDir, "officers-academy-theme");
        archive.finalize();
      });

      console.log("[WP Exporter] Theme ZIP package generated on disk. Directing client download...");
      res.download(zipDestPath, "officers-academy-theme.zip");
    } catch (e) {
      console.error("[WP Exporter] Severe error in exporter endpoint:", e);
      res.status(500).send("Severe server-side theme compression failed.");
    }
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
