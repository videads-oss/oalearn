<?php
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
    register_rest_route('officers-academy/v1', '/pdf/(?P<id>\d+)/view', array(
        'methods' => 'POST',
        'callback' => 'oa_inc_view',
        'permission_callback' => '__return_true'
    ));
    register_rest_route('officers-academy/v1', '/pdf/(?P<id>\d+)/download', array(
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
