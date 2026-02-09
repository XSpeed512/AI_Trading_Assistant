<?php
session_start();
require_once '../config/db_connect.php';
require_once '../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';

    // Validazioni base
    if (!$username || !$email || !$password || !$confirm_password) {
        $_SESSION['error'] = "Tutti i campi sono obbligatori.";
        header("Location: ../auth/register.php");
        exit();
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $_SESSION['error'] = "Email non valida.";
        header("Location: ../auth/register.php");
        exit();
    }

    if ($password !== $confirm_password) {
        $_SESSION['error'] = "Le password non coincidono.";
        header("Location: ../auth/register.php");
        exit();
    }

    // Controlla se esiste già l'email
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        $_SESSION['error'] = "Email già registrata.";
        header("Location: ../auth/register.php");
        exit();
    }

    // Hash della password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // Inserimento utente
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, 'user', NOW())");
    if ($stmt->execute([$username, $email, $hashed_password])) {
        $_SESSION['success'] = "Registrazione completata! Ora puoi accedere.";
        header("Location: ../auth/login.php");
        exit();
    } else {
        $_SESSION['error'] = "Errore nella registrazione.";
        header("Location: ../auth/register.php");
        exit();
    }
} else {
    header("Location: ../auth/register.php");
    exit();
}
