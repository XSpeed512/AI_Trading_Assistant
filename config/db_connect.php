<?php
require_once __DIR__ . '/../config/config.php';

try {
    // Creiamo la connessione PDO
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    // Modalità di errore -> eccezioni
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (PDOException $e) {
    error_log("DB connect error: " . $e->getMessage());
    die("Errore connessione DB");
}

