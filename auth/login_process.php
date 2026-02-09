<?php
session_start();
require_once '../config/db_connect.php';       
require_once '../includes/functions.php';    

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    // Controllo campi vuoti
    if (empty($email) || empty($password)) {
        $_SESSION['error'] = "Inserisci email e password.";
        header("Location: ../auth/login.php");
        exit();
    }

    // Recupero utente dal database
    $stmt = $conn->prepare("SELECT id, username, password, role FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password'])) {
        // Login corretto → rigenera ID sessione per sicurezza
        session_regenerate_id(true);
        $_SESSION['user_id']   = $user['id'];
        $_SESSION['username']  = $user['username'];
        $_SESSION['role']      = $user['role'];

        // Redirect in base al ruolo
       if(isset( $_SESSION['user_id'])){
                header("Location: ../index.php");
                exit();
        }
        exit();
    }

    // Se login fallisce
    $_SESSION['error'] = "Email o password errati.";
    header("Location: ../auth/login.php");
    exit();
}
?>