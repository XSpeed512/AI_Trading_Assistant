<?php

if (session_status() === PHP_SESSION_NONE) session_start();

// DB
define('DB_HOST', 'localhost'); 
define('DB_USER', 'provacurricullum');  
define('DB_PASS', '');   
define('DB_NAME', 'my_provacurricullum');   

// API keys
define('OPENAI_API_KEY', getenv('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') ?: ''); // prefer env
define('ALPHA_VANTAGE_KEY', getenv('ALPHA_VANTAGE_KEY') ?: ''); // for market data

// Other
define('SITE_URL', 'https://provacurricullum.altervista.org'); // update if needed
?>
