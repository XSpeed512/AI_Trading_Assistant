<?php

if (session_status() === PHP_SESSION_NONE) session_start();

// DB
define('DB_HOST', 'localhost'); 
define('DB_USER', 'provacurricullum');  
define('DB_PASS', '');   
define('DB_NAME', 'my_provacurricullum');   

// API keys
define('OPENAI_API_KEY', getenv('') ?: ''); // prefer env
define('ALPHA_VANTAGE_KEY', getenv('ALPHA_VANTAGE_KEY') ?: ''); // for market data

// Other
define('SITE_URL', 'https://provacurricullum.altervista.org'); // update if needed
?>
