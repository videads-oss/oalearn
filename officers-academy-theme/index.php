<?php
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
</html>