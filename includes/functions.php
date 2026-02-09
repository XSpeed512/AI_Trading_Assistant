<?php

if (session_status() === PHP_SESSION_NONE) session_start();


function currentUserId() {
    return $_SESSION['user_id'] ?? null;
}

function logAction($mysqli, $action, $details = null) {
    $user_id = currentUserId();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $stmt = $mysqli->prepare("INSERT INTO logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("isss", $user_id, $action, $details, $ip);
        $stmt->execute();
        $stmt->close();
    }
}

