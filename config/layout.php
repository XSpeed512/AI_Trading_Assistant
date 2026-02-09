<?php
session_start();

require("../config/db_connect.php"); 
header('Content-Type: application/json');

// === Check login ===
if (!isset($_SESSION['user_id'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([]); // ospite → nessun layout salvato
    } else {
        http_response_code(403);
        echo json_encode(["error" => "Non autenticato"]);
    }
    exit;
}


$user_id = $_SESSION['user_id'];

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // ----- Salvataggio -----
        $raw = file_get_contents("php://input");
        $widgets = json_decode($raw, true);

        if (!is_array($widgets)) {
            http_response_code(400);
            echo json_encode(["error" => "Payload non valido"]);
            exit;
        }

        // Elimina i vecchi widget dell'utente
        $stmt = $conn->prepare("DELETE FROM user_widgets WHERE user_id = ?");
        $stmt->execute([$user_id]);

        // Inserisci i nuovi widget
        $stmt = $conn->prepare("
            INSERT INTO user_widgets (user_id, widget_key, x, y, width, height) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        foreach ($widgets as $w) {
            $stmt->execute([
                $user_id,
                $w['id'] ?? "custom" ,   // GridStack usa "id"
                (int)($w['x'] ?? 0),
                (int)($w['y'] ?? 0),
                (int)($w['w'] ?? 4),    // GridStack usa "w"
                (int)($w['h'] ?? 3)     // GridStack usa "h"
            ]);
        }

        echo json_encode(["success" => true, "count" => count($widgets)]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // ----- Caricamento -----
        $stmt = $conn->prepare("SELECT widget_key AS id, x, y, width AS w, height AS h
            FROM user_widgets 
            WHERE user_id = ? 
            ORDER BY y, x
        ");
        $stmt->execute([$user_id]);
        $widgets = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Cast valori numerici
        foreach ($widgets as &$w) {
            $w['x'] = (int)$w['x'];
            $w['y'] = (int)$w['y'];
            $w['w'] = (int)$w['w'];
            $w['h'] = (int)$w['h'];
        }

        echo json_encode($widgets);
        exit;
    }

    http_response_code(405);
    echo json_encode(["error" => "Metodo non supportato"]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
